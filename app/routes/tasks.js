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

async function insertBatchTaskTags(client, taskId, rawTags, batchComment = '') {
    if (!Array.isArray(rawTags) || rawTags.length === 0) {
        throw new HttpError(400, 'Wybierz przynajmniej jeden tag do przypisania.');
    }

    const normalizedBatchComment = String(batchComment || '').trim() || null;

    // Fetch referenced tags in bulk
    const ids = [...new Set(rawTags.map((item) => Number(item && item.tag_id)).filter((n) => Number.isInteger(n) && n > 0))];
    const names = [...new Set(rawTags.map((item) => (item && item.tag_nazwa ? String(item.tag_nazwa) : null)).filter(Boolean))];

    const tagById = new Map();
    const tagByName = new Map();

    if (ids.length > 0) {
        const resById = await client.query('SELECT * FROM slownik_tagow WHERE id = ANY($1::int[]);', [ids]);
        for (const r of resById.rows) {
            tagById.set(r.id, r);
            tagByName.set(r.nazwa, r);
        }
    }
    if (names.length > 0) {
        const resByName = await client.query('SELECT * FROM slownik_tagow WHERE nazwa = ANY($1::varchar[]);', [names]);
        for (const r of resByName.rows) {
            tagById.set(r.id, r);
            tagByName.set(r.nazwa, r);
        }
    }

    // Validate entire batch before inserting anything
    const prepared = [];
    for (const item of rawTags) {
        if (!item || typeof item !== 'object') {
            throw new HttpError(400, 'Nieprawidłowy element na liście tagów.');
        }

        const tagRow = item.tag_id
            ? tagById.get(Number(item.tag_id))
            : item.tag_nazwa
              ? tagByName.get(String(item.tag_nazwa))
              : null;

        if (!tagRow) {
            throw new HttpError(400, 'Wybrany tag nie istnieje w słowniku.');
        }

        let normalizedPol = null;
        if (item.polaryzacja === '+' || item.polaryzacja === 'pos') normalizedPol = '+';
        else if (item.polaryzacja === '-' || item.polaryzacja === 'neg') normalizedPol = '-';

        if (tagRow.kategoria === 'DOBROSTAN') {
            normalizedPol = '-';
        }
        if (!normalizedPol) {
            throw new HttpError(400, "Nieprawidłowa polaryzacja tagu (dozwolone: '+' lub '-').");
        }

        const itemComment =
            item.komentarz !== undefined && item.komentarz !== null && String(item.komentarz).trim() !== ''
                ? String(item.komentarz).trim()
                : normalizedBatchComment;

        prepared.push({
            tagRow,
            polaryzacja: normalizedPol,
            komentarz: itemComment,
        });
    }

    const inserted = [];
    for (const entry of prepared) {
        const insRes = await client.query(
            `INSERT INTO zadanie_tagi (zadanie_id, tag_id, polaryzacja, komentarz)
             VALUES ($1, $2, $3, $4)
             RETURNING *;`,
            [taskId, entry.tagRow.id, entry.polaryzacja, entry.komentarz]
        );
        inserted.push({
            ...insRes.rows[0],
            tag_nazwa: entry.tagRow.nazwa,
            kategoria: entry.tagRow.kategoria,
            tag_opis: entry.tagRow.opis,
        });
    }

    return inserted;
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
            tags = [],
            komentarz = '',
        } = req.body || {};

        if (!tytul || !String(tytul).trim()) {
            throw new HttpError(400, 'Tytuł zadania/obserwacji jest wymagany.');
        }
        if (!ALLOWED_VISIBILITY.has(widocznosc)) {
            throw new HttpError(400, 'Nieprawidłowa widoczność (dozwolone: OBIE_STRONY, TYLKO_MENEDZER).');
        }
        if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
            throw new HttpError(400, 'Pole tags musi być tablicą.');
        }

        const task = await withTransaction(async (client) => {
            const evalRow = await getEvaluationOrThrow(client, evalId);
            assertCanEvaluate(req.currentUser, evalRow);

            const insRes = await client.query(
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
            const createdTask = insRes.rows[0];
            const insertedTags =
                Array.isArray(tags) && tags.length > 0
                    ? await insertBatchTaskTags(client, createdTask.id, tags, komentarz)
                    : [];

            return { ...createdTask, tags: insertedTags };
        });

        res.status(201).json({ task });
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

        const body = req.body || {};
        const isBatchPayload = Object.prototype.hasOwnProperty.call(body, 'tags');
        const rawTags = isBatchPayload
            ? body.tags
            : [
                  {
                      tag_id: body.tag_id,
                      tag_nazwa: body.tag_nazwa,
                      polaryzacja: body.polaryzacja,
                      komentarz: body.komentarz,
                  },
              ];

        const taskTags = await withTransaction(async (client) => {
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

            return insertBatchTaskTags(client, taskId, rawTags, body.komentarz || '');
        });

        res.status(201).json({ taskTags, taskTag: taskTags[0] });
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
