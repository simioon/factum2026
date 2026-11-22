const express = require('express');
const { query, withTransaction } = require('../db/pool');
const {
    USER_PUBLIC_COLUMNS,
    formatUser,
    requireUser,
    requireRole,
} = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const {
    ACTIVE_STATUSES,
    ACTIVE_EVAL_ORDER_SQL,
    createActiveCycle,
    hydrateEvaluation,
} = require('../db/evaluationService');
const {
    computeCriterionTagSuggestion,
    computeEmployeeAlerts,
    checkAutoRankPromotion,
    slugifyEmail,
} = require('../domain/legalRules');

const router = express.Router();

const ALLOWED_ROLES = new Set(['OCENIANY', 'OCENIAJACY', 'DYREKTOR', 'ADMIN']);
const ALLOWED_SHEETS = new Set(['A', 'B', 'C']);

function isValidRoleAndSheet(rola, arkusz) {
    if (rola === 'OCENIANY') {
        return arkusz === 'C';
    }
    if (rola === 'OCENIAJACY') {
        return arkusz === 'A' || arkusz === 'B';
    }
    if (rola === 'DYREKTOR' || rola === 'ADMIN') {
        return arkusz === null;
    }
    return false;
}

function getRoleSheetErrorMessage(rola) {
    if (rola === 'OCENIANY') {
        return 'Dla roli OCENIANY dozwolony jest wyłącznie Arkusz C.';
    }
    if (rola === 'OCENIAJACY') {
        return 'Dla roli OCENIAJACY dozwolony jest wyłącznie Arkusz A lub B.';
    }
    return 'Dla roli DYREKTOR oraz ADMIN arkusz musi być pusty (null).';
}

router.get(
    '/users',
    asyncHandler(async (req, res) => {
        const usersRes = await query(
            `SELECT ${USER_PUBLIC_COLUMNS}
             FROM uzytkownicy
             ORDER BY
                CASE rola
                    WHEN 'OCENIANY' THEN 0
                    WHEN 'OCENIAJACY' THEN 1
                    WHEN 'DYREKTOR' THEN 2
                    WHEN 'ADMIN' THEN 3
                    ELSE 4
                END ASC,
                id ASC;`
        );

        const activeEvalsRes = await query(
            `SELECT DISTINCT ON (pracownik_id)
                id, pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow,
                data_rozmowy_wstepnej, planowana_data_oceny
             FROM oceny_okresowe
             WHERE status = ANY($1::varchar[])
             ORDER BY pracownik_id, ${ACTIVE_EVAL_ORDER_SQL};`,
            [ACTIVE_STATUSES]
        );
        const activeEvalByUser = new Map(activeEvalsRes.rows.map((e) => [e.pracownik_id, e]));

        const lastCompletedRes = await query(
            `SELECT DISTINCT ON (pracownik_id)
                id, pracownik_id, srednia_punktow, wynik_ogolny, data_zapoznania_z_ocena
             FROM oceny_okresowe
             WHERE status = 'ZAKONCZONA'
             ORDER BY pracownik_id, COALESCE(data_zapoznania_z_ocena, data_rozmowy_oceniajacej, created_at::date) DESC, id DESC;`
        );
        const lastCompletedByUser = new Map(lastCompletedRes.rows.map((e) => [e.pracownik_id, e]));

        const activeEvalIds = activeEvalsRes.rows.map((e) => e.id);
        const tagsByEvalId = new Map();
        if (activeEvalIds.length > 0) {
            const tasksRes = await query(
                `SELECT
                    zo.ocena_id,
                    zt.polaryzacja,
                    st.kategoria
                 FROM zadania_obserwacje zo
                 JOIN zadanie_tagi zt ON zt.zadanie_id = zo.id
                 JOIN slownik_tagow st ON st.id = zt.tag_id
                 WHERE zo.ocena_id = ANY($1::int[]);`,
                [activeEvalIds]
            );
            for (const row of tasksRes.rows) {
                if (!tagsByEvalId.has(row.ocena_id)) {
                    tagsByEvalId.set(row.ocena_id, []);
                }
                tagsByEvalId.get(row.ocena_id).push(row);
            }
        }

        const users = usersRes.rows.map((row) => {
            const base = formatUser(row);
            const active = activeEvalByUser.get(base.id) || null;
            const prevEval = lastCompletedByUser.get(base.id) || null;
            const rawTags = active ? tagsByEvalId.get(active.id) || [] : [];

            let posTagCount = 0;
            let negTagCount = 0;
            let wellbeingTagCount = 0;
            for (const tg of rawTags) {
                if (tg.kategoria === 'DOBROSTAN') wellbeingTagCount++;
                else if (tg.polaryzacja === '+') posTagCount++;
                else if (tg.polaryzacja === '-') negTagCount++;
            }

            const fakeTasks = rawTags.length > 0 ? [{ tags: rawTags }] : [];
            const alerts = active
                ? computeEmployeeAlerts({ activeEval: active, tasks: fakeTasks, previousEval: prevEval })
                : [];

            return {
                ...base,
                activeEvaluationId: active ? active.id : null,
                activeStatus: active ? active.status : null,
                cycleStartDate: active ? active.data_rozpoczecia_cyklu : null,
                cycleEndDate: active ? active.planowana_data_oceny : null,
                interviewDeadline: active ? active.termin_wyznaczenia_kryteriow : null,
                initialInterviewDate: active ? active.data_rozmowy_wstepnej : null,
                posTagCount,
                negTagCount,
                wellbeingTagCount,
                alerts,
            };
        });

        res.json({ users });
    })
);

router.get(
    '/users/:id/workspace',
    requireUser,
    asyncHandler(async (req, res) => {
        const empId = Number(req.params.id);
        if (!Number.isInteger(empId) || empId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID użytkownika.');
        }

        const empRes = await query(
            `SELECT ${USER_PUBLIC_COLUMNS} FROM uzytkownicy WHERE id = $1;`,
            [empId]
        );
        if (empRes.rows.length === 0) {
            throw new HttpError(404, 'Użytkownik nie istnieje.');
        }
        const user = formatUser(empRes.rows[0]);

        const canAccess =
            req.currentUser.id === empId ||
            req.currentUser.id === user.przelozony_id ||
            req.currentUser.rola === 'DYREKTOR' ||
            req.currentUser.rola === 'ADMIN';

        if (!canAccess) {
            const evalCheck = await query(
                'SELECT 1 FROM oceny_okresowe WHERE pracownik_id = $1 AND oceniajacy_id = $2 LIMIT 1;',
                [empId, req.currentUser.id]
            );
            if (evalCheck.rows.length === 0) {
                throw new HttpError(403, 'Brak dostępu do przestrzeni roboczej tego pracownika.');
            }
        }

        const isSelfOnly = req.currentUser.id === empId;

        let evaluator = null;
        if (user.przelozony_id) {
            const evRes = await query(
                `SELECT ${USER_PUBLIC_COLUMNS} FROM uzytkownicy WHERE id = $1;`,
                [user.przelozony_id]
            );
            evaluator = evRes.rows[0] ? formatUser(evRes.rows[0]) : null;
        }

        const activeRes = await query(
            `SELECT * FROM oceny_okresowe
             WHERE pracownik_id = $1 AND status = ANY($2::varchar[])
             ORDER BY ${ACTIVE_EVAL_ORDER_SQL}
             LIMIT 1;`,
            [empId, ACTIVE_STATUSES]
        );
        const activeEvalRow = activeRes.rows[0] || null;
        const activeEvaluation = activeEvalRow
            ? await hydrateEvaluation({ query }, activeEvalRow, { includePrivateTasks: !isSelfOnly })
            : null;

        const pastRes = await query(
            `SELECT * FROM oceny_okresowe
             WHERE pracownik_id = $1 AND status IN ('ZAKONCZONA', 'ODWOLANIE_W_TOKU', 'UNIEWAZNIONA')
             ORDER BY COALESCE(data_zapoznania_z_ocena, data_rozmowy_oceniajacej, created_at::date) DESC, id DESC;`,
            [empId]
        );
        const pastEvaluations = await Promise.all(
            pastRes.rows.map((row) => hydrateEvaluation({ query }, row, { includePrivateTasks: !isSelfOnly }))
        );

        const tagSummariesByCriterion = {};
        if (activeEvaluation) {
            for (const crit of activeEvaluation.criteria) {
                let posCount = 0;
                let negCount = 0;
                const entries = [];

                for (const task of activeEvaluation.tasks) {
                    for (const tg of task.tags) {
                        if (tg.kategoria !== 'DOBROSTAN' && tg.kryteria_ids.includes(crit.kryterium_id)) {
                            if (tg.polaryzacja === '+') posCount++;
                            else negCount++;
                            entries.push({
                                taskId: task.id,
                                taskTitle: task.tytul,
                                taskDate: task.data_zdarzenia,
                                tagId: tg.tag_nazwa,
                                polarity: tg.polaryzacja,
                                comment: tg.komentarz,
                            });
                        }
                    }
                }

                const suggestion = computeCriterionTagSuggestion(posCount, negCount);
                tagSummariesByCriterion[crit.kryterium_id] = {
                    posCount,
                    negCount,
                    total: posCount + negCount,
                    entries,
                    ...suggestion,
                };
            }
        }

        const lastCompletedEval = pastEvaluations.find((e) => e.status === 'ZAKONCZONA') || null;
        const alerts = activeEvaluation
            ? computeEmployeeAlerts({
                  activeEval: activeEvaluation,
                  tasks: activeEvaluation.tasks,
                  previousEval: lastCompletedEval,
              })
            : [];

        const prevPositiveOverSix = Boolean(
            lastCompletedEval &&
                lastCompletedEval.wynik_ogolny === 'POZYTYWNA' &&
                Number(lastCompletedEval.srednia_punktow) > 6 &&
                user.employmentType === 'MIANOWANIE' &&
                user.aktualny_stopien_sluzbowy < 9
        );

        res.json({
            user,
            evaluator,
            activeEvaluation,
            pastEvaluations,
            tagSummariesByCriterion,
            alerts,
            previousEvalEligibleForAutoPromotion: prevPositiveOverSix,
        });
    })
);

router.post(
    '/users',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const {
            imie_nazwisko,
            email,
            arkusz,
            rola,
            aktualny_stopien_sluzbowy = 0,
            nazwa_stanowiska,
            komorka_organizacyjna = 'Nowa komórka organizacyjna',
            przelozony_id = null,
        } = req.body || {};

        if (!imie_nazwisko || !String(imie_nazwisko).trim()) {
            throw new HttpError(400, 'Pole imie_nazwisko jest wymagane.');
        }
        if (!nazwa_stanowiska || !String(nazwa_stanowiska).trim()) {
            throw new HttpError(400, 'Pole nazwa_stanowiska jest wymagane.');
        }
        if (!ALLOWED_ROLES.has(rola)) {
            throw new HttpError(400, 'Nieprawidłowa rola użytkownika.');
        }

        const normalizedArkusz = arkusz === '' || arkusz === undefined ? null : arkusz;
        if (normalizedArkusz !== null && !ALLOWED_SHEETS.has(normalizedArkusz)) {
            throw new HttpError(400, 'Nieprawidłowy kod arkusza (dozwolone: A, B, C lub null).');
        }
        if (!isValidRoleAndSheet(rola, normalizedArkusz)) {
            throw new HttpError(400, getRoleSheetErrorMessage(rola));
        }

        const stopien = Number(aktualny_stopien_sluzbowy);
        if (!Number.isInteger(stopien) || stopien < 0 || stopien > 9) {
            throw new HttpError(400, 'Stopień służbowy musi być liczbą całkowitą od 0 do 9.');
        }
        if (rola === 'ADMIN' && stopien !== 0) {
            throw new HttpError(400, 'Konto techniczne ADMIN nie może posiadać stopnia służbowego.');
        }

        const evaluatorId =
            przelozony_id === null || przelozony_id === '' || przelozony_id === undefined
                ? null
                : Number(przelozony_id);

        if (evaluatorId !== null && (!Number.isInteger(evaluatorId) || evaluatorId <= 0)) {
            throw new HttpError(400, 'Nieprawidłowe ID przełożonego.');
        }
        if ((rola === 'DYREKTOR' || rola === 'ADMIN') && evaluatorId !== null) {
            throw new HttpError(400, 'Role DYREKTOR oraz ADMIN nie mogą mieć przypisanego przełożonego.');
        }

        if (evaluatorId !== null) {
            const evalCheck = await query('SELECT id, rola FROM uzytkownicy WHERE id = $1;', [evaluatorId]);
            if (evalCheck.rows.length === 0) {
                throw new HttpError(400, 'Wybrany przełożony nie istnieje.');
            }
            if (!['OCENIAJACY', 'DYREKTOR'].includes(evalCheck.rows[0].rola)) {
                throw new HttpError(400, 'Przełożony musi mieć rolę OCENIAJACY lub DYREKTOR.');
            }
        }

        const created = await withTransaction(async (client) => {
            let finalEmail = email && String(email).trim().toLowerCase();
            if (!finalEmail) {
                const base = slugifyEmail(imie_nazwisko);
                const [localPart, domain] = base.split('@');
                finalEmail = base;
                let suffix = 2;
                while (true) {
                    const dup = await client.query('SELECT 1 FROM uzytkownicy WHERE email = $1;', [finalEmail]);
                    if (dup.rows.length === 0) break;
                    finalEmail = `${localPart}${suffix}@${domain}`;
                    suffix++;
                }
            }

            const insertRes = await client.query(
                `INSERT INTO uzytkownicy (
                    imie_nazwisko, email, arkusz, rola, haslo_hash,
                    aktualny_stopien_sluzbowy, nazwa_stanowiska, komorka_organizacyjna, przelozony_id
                ) VALUES ($1, $2, $3, $4, 'DEMO_NO_PASSWORD_AUTH', $5, $6, $7, $8)
                RETURNING ${USER_PUBLIC_COLUMNS};`,
                [
                    String(imie_nazwisko).trim(),
                    finalEmail,
                    normalizedArkusz,
                    rola,
                    rola === 'ADMIN' ? 0 : stopien,
                    String(nazwa_stanowiska).trim(),
                    String(komorka_organizacyjna || 'Nowa komórka organizacyjna').trim(),
                    evaluatorId,
                ]
            );
            const newUser = formatUser(insertRes.rows[0]);

            let activeEvaluation = null;
            if (evaluatorId && newUser.arkusz && newUser.rola !== 'DYREKTOR' && newUser.rola !== 'ADMIN') {
                activeEvaluation = await createActiveCycle(client, {
                    pracownikId: newUser.id,
                    oceniajacyId: evaluatorId,
                    typArkusza: newUser.arkusz,
                });
            }

            return { user: newUser, activeEvaluation };
        });

        res.status(201).json(created);
    })
);

router.patch(
    '/users/:id/evaluator',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID użytkownika.');
        }

        const rawEvalId = req.body ? req.body.przelozony_id : undefined;
        const newEvaluatorId = rawEvalId === null || rawEvalId === '' || rawEvalId === undefined ? null : Number(rawEvalId);
        if (newEvaluatorId !== null && (!Number.isInteger(newEvaluatorId) || newEvaluatorId <= 0)) {
            throw new HttpError(400, 'Nieprawidłowe ID przełożonego.');
        }
        if (newEvaluatorId === userId) {
            throw new HttpError(400, 'Pracownik nie może być własnym przełożonym.');
        }

        const result = await withTransaction(async (client) => {
            const targetRes = await client.query(
                `SELECT ${USER_PUBLIC_COLUMNS} FROM uzytkownicy WHERE id = $1;`,
                [userId]
            );
            if (targetRes.rows.length === 0) {
                throw new HttpError(404, 'Użytkownik nie istnieje.');
            }
            const targetUser = targetRes.rows[0];
            if ((targetUser.rola === 'DYREKTOR' || targetUser.rola === 'ADMIN') && newEvaluatorId !== null) {
                throw new HttpError(400, 'Nie można przypisać przełożonego dla roli DYREKTOR lub ADMIN.');
            }

            let newEvaluatorName = null;
            if (newEvaluatorId !== null) {
                const evRes = await client.query(
                    'SELECT id, imie_nazwisko, rola FROM uzytkownicy WHERE id = $1;',
                    [newEvaluatorId]
                );
                if (evRes.rows.length === 0) {
                    throw new HttpError(400, 'Wybrany przełożony nie istnieje.');
                }
                if (!['OCENIAJACY', 'DYREKTOR'].includes(evRes.rows[0].rola)) {
                    throw new HttpError(400, 'Przełożony musi mieć rolę OCENIAJACY lub DYREKTOR.');
                }
                newEvaluatorName = evRes.rows[0].imie_nazwisko;
            }

            const updUserRes = await client.query(
                `UPDATE uzytkownicy
                 SET przelozony_id = $1
                 WHERE id = $2
                 RETURNING ${USER_PUBLIC_COLUMNS};`,
                [newEvaluatorId, userId]
            );
            const updatedUser = formatUser(updUserRes.rows[0]);

            const activeRes = await client.query(
                `SELECT * FROM oceny_okresowe
                 WHERE pracownik_id = $1 AND status = ANY($2::varchar[])
                 ORDER BY ${ACTIVE_EVAL_ORDER_SQL}
                 LIMIT 1;`,
                [userId, ACTIVE_STATUSES]
            );

            let loggedEvent = null;
            if (activeRes.rows.length > 0 && newEvaluatorId !== null) {
                const activeEval = activeRes.rows[0];
                if (activeEval.oceniajacy_id !== newEvaluatorId) {
                    await client.query(
                        `UPDATE oceny_okresowe
                         SET oceniajacy_id = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2;`,
                        [newEvaluatorId, activeEval.id]
                    );
                    const evLog = await client.query(
                        `INSERT INTO zdarzenia_kadrowe (
                            ocena_id, typ_zdarzenia, data_od, dni_przesuniecia_terminu, opis
                         ) VALUES ($1, 'ZMIANA_OCENIAJACEGO', CURRENT_DATE, 0, $2)
                         RETURNING *;`,
                        [activeEval.id, `Zmiana oceniającego na: ${newEvaluatorName}`]
                    );
                    loggedEvent = evLog.rows[0];
                }
            } else if (
                activeRes.rows.length === 0 &&
                newEvaluatorId !== null &&
                updatedUser.arkusz &&
                updatedUser.rola !== 'DYREKTOR' &&
                updatedUser.rola !== 'ADMIN'
            ) {
                await createActiveCycle(client, {
                    pracownikId: updatedUser.id,
                    oceniajacyId: newEvaluatorId,
                    typArkusza: updatedUser.arkusz,
                });
            }

            return { user: updatedUser, loggedEvent };
        });

        res.json(result);
    })
);

module.exports = router;