const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireUser } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { assertCanViewEvaluation, assertCanEvaluate } = require('../db/evaluationService');
const { todayIso } = require('../domain/legalRules');

const router = express.Router();

const ALLOWED_VISIBILITY = new Set(['OBIE_STRONY', 'TYLKO_MENEDZER']);

async function getEvaluationOrThrow(db, evalId) {
    const res = await db.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
    if (res.rows.length === 0) {
        throw new HttpError(404, 'Ocena okresowa nie istnieje.');
    }
    return res.rows[0];
}

router.get(
    '/evaluations/:evalId/tasks',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }
        const evalRow = await getEvaluationOrThrow({ query }, evalId);
        assertCanViewEvaluation(req.currentUser, evalRow);

        const includePrivate = req.currentUser.id !== evalRow.pracownik_id;
        const visibilityFilter = includePrivate ? '' : "AND zo.widocznosc = 'OBIE_STRONY'";

        const tasksRes = await query(
            `SELECT zo.*, u.imie_nazwisko AS autor_nazwa
             FROM zadania_obserwacje zo
             LEFT JOIN uzytkownicy u ON u.id = zo.autor_id
             WHERE zo.ocena_id = $1 ${visibilityFilter}
             ORDER BY zo.data_zdarzenia DESC, zo.id DESC;`,
            [evalId]
        );

        const taskIds = tasksRes.rows.map((t) => t.id);
        const tagsByTaskId = new Map();
        if (taskIds.length > 0) {
            const tagsRes = await query(
                `SELECT zt.*, st.nazwa AS tag_nazwa, st.kategoria, st.opis AS tag_opis
                 FROM zadanie_tagi zt
                 JOIN slownik_tagow st ON st.id = zt.tag_id
                 WHERE zt.zadanie_id = ANY($1::int[])
                 ORDER BY zt.id ASC;`,
                [taskIds]
            );
            for (const row of tagsRes.rows) {
                if (!tagsByTaskId.has(row.zadanie_id)) tagsByTaskId.set(row.zadanie_id, []);
                tagsByTaskId.get(row.zadanie_id).push(row);
            }
        }

        const tasks = tasksRes.rows.map((t) => ({ ...t, tags: tagsByTaskId.get(t.id) || [] }));
        res.json({ tasks });
    })
);

router.post(
    '/evaluations/:evalId/tasks',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const {
            tytul,
            opis = '',
            data_zdarzenia = todayIso(),
            widocznosc = 'OBIE_STRONY',
        } = req.body || {};

        if (!tytul || !String(tytul).trim()) {
            throw new HttpError(400, 'Tytuł zadania/obserwacji jest wymagany.');
        }
        if (!ALLOWED_VISIBILITY.has(widocznosc)) {
            throw new HttpError(400, 'Nieprawidłowa widoczność (dozwolone: OBIE_STRONY, TYLKO_MENEDZER).');
        }

        const evalRow = await getEvaluationOrThrow({ query }, evalId);
        assertCanEvaluate(req.currentUser, evalRow);

        const insRes = await query(
            `INSERT INTO zadania_obserwacje (ocena_id, autor_id, tytul, opis, data_zdarzenia, widocznosc)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *;`,
            [
                evalId,
                req.currentUser.id,
                String(tytul).trim(),
                String(opis || '').trim() || null,
                String(data_zdarzenia || todayIso()),
                widocznosc,
            ]
        );

        res.status(201).json({ task: { ...insRes.rows[0], tags: [] } });
    })
);

router.delete(
    '/tasks/:taskId',
    requireUser,
    asyncHandler(async (req, res) => {
        const taskId = Number(req.params.taskId);
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID zadania.');
        }

        const taskRes = await query(
            `SELECT zo.*, oo.oceniajacy_id, oo.pracownik_id
             FROM zadania_obserwacje zo
             JOIN oceny_okresowe oo ON oo.id = zo.ocena_id
             WHERE zo.id = $1;`,
            [taskId]
        );
        if (taskRes.rows.length === 0) {
            throw new HttpError(404, 'Zadanie nie istnieje.');
        }
        const row = taskRes.rows[0];
        assertCanEvaluate(req.currentUser, { oceniajacy_id: row.oceniajacy_id });

        await query('DELETE FROM zadania_obserwacje WHERE id = $1;', [taskId]);
        res.json({ deleted: true, id: taskId });
    })
);

router.post(
    '/tasks/:taskId/tags',
    requireUser,
    asyncHandler(async (req, res) => {
        const taskId = Number(req.params.taskId);
        if (!Number.isInteger(taskId) || taskId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID zadania.');
        }

        const { tag_id, tag_nazwa, polaryzacja, komentarz = '' } = req.body || {};

        const taskTag = await withTransaction(async (client) => {
            const taskRes = await client.query(
                `SELECT zo.id, oo.oceniajacy_id
                 FROM zadania_obserwacje zo
                 JOIN oceny_okresowe oo ON oo.id = zo.ocena_id
                 WHERE zo.id = $1;`,
                [taskId]
            );
            if (taskRes.rows.length === 0) {
                throw new HttpError(404, 'Zadanie nie istnieje.');
            }
            assertCanEvaluate(req.currentUser, { oceniajacy_id: taskRes.rows[0].oceniajacy_id });

            let tagRow;
            if (tag_id) {
                const tr = await client.query('SELECT * FROM slownik_tagow WHERE id = $1;', [Number(tag_id)]);
                tagRow = tr.rows[0];
            } else if (tag_nazwa) {
                const tr = await client.query('SELECT * FROM slownik_tagow WHERE nazwa = $1;', [String(tag_nazwa)]);
                tagRow = tr.rows[0];
            }
            if (!tagRow) {
                throw new HttpError(400, 'Wybrany tag nie istnieje w słowniku.');
            }

            let normalizedPol = null;
            if (polaryzacja === '+' || polaryzacja === 'pos') normalizedPol = '+';
            else if (polaryzacja === '-' || polaryzacja === 'neg') normalizedPol = '-';
            if (!normalizedPol) {
                throw new HttpError(400, "Nieprawidłowa polaryzacja tagu (dozwolone: '+' lub '-').");
            }
            if (tagRow.kategoria === 'DOBROSTAN') {
                normalizedPol = '-';
            }

            const insRes = await client.query(
                `INSERT INTO zadanie_tagi (zadanie_id, tag_id, polaryzacja, komentarz)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *;`,
                [taskId, tagRow.id, normalizedPol, String(komentarz || '').trim() || null]
            );

            return {
                ...insRes.rows[0],
                tag_nazwa: tagRow.nazwa,
                kategoria: tagRow.kategoria,
                tag_opis: tagRow.opis,
            };
        });

        res.status(201).json({ taskTag });
    })
);

router.delete(
    '/tasks/:taskId/tags/:taskTagId',
    requireUser,
    asyncHandler(async (req, res) => {
        const taskId = Number(req.params.taskId);
        const taskTagId = Number(req.params.taskTagId);
        if (!Number.isInteger(taskId) || !Number.isInteger(taskTagId)) {
            throw new HttpError(400, 'Nieprawidłowe identyfikatory.');
        }

        const checkRes = await query(
            `SELECT zt.id, oo.oceniajacy_id
             FROM zadanie_tagi zt
             JOIN zadania_obserwacje zo ON zo.id = zt.zadanie_id
             JOIN oceny_okresowe oo ON oo.id = zo.ocena_id
             WHERE zt.id = $1 AND zt.zadanie_id = $2;`,
            [taskTagId, taskId]
        );
        if (checkRes.rows.length === 0) {
            throw new HttpError(404, 'Przypisanie tagu nie istnieje.');
        }
        assertCanEvaluate(req.currentUser, { oceniajacy_id: checkRes.rows[0].oceniajacy_id });

        await query('DELETE FROM zadanie_tagi WHERE id = $1;', [taskTagId]);
        res.json({ deleted: true, id: taskTagId });
    })
);

module.exports = router;
