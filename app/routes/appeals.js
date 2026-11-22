const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireUser, requireRole } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { createActiveCycle, hydrateEvaluation } = require('../db/evaluationService');
const {
    LEGAL_CONFIG,
    APPEAL_DECISION_LABELS,
    todayIso,
    addDaysIso,
    diffDaysIso,
} = require('../domain/legalRules');

const router = express.Router();

const APPEAL_DECISIONS = new Set([
    'ODRZUCONY',
    'UWZGLEDNIONY_ZMIANA',
    'UWZGLEDNIONY_PONOWNA_OCENA',
    'NIEROZPATRZONY_W_TERMINIE',
]);

router.get(
    '/appeals',
    requireUser,
    asyncHandler(async (req, res) => {
        const conditions = [];
        const params = [];

        if (req.currentUser.rola === 'OCENIANY') {
            params.push(req.currentUser.id);
            conditions.push(`oo.pracownik_id = $${params.length}`);
        } else if (req.currentUser.rola === 'OCENIAJACY') {
            params.push(req.currentUser.id);
            conditions.push(`(oo.oceniajacy_id = $${params.length} OR oo.pracownik_id = $${params.length})`);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowsRes = await query(
            `SELECT
                so.*,
                oo.pracownik_id,
                oo.oceniajacy_id,
                oo.typ_arkusza,
                oo.numer_podejscia,
                oo.srednia_punktow,
                oo.wynik_ogolny,
                oo.data_zapoznania_z_ocena,
                oo.status AS evaluation_status,
                p.imie_nazwisko AS pracownik_nazwa,
                p.nazwa_stanowiska AS pracownik_stanowisko,
                o.imie_nazwisko AS oceniajacy_nazwa
             FROM sprzeciwy_odwolania so
             JOIN oceny_okresowe oo ON oo.id = so.ocena_id
             JOIN uzytkownicy p ON p.id = oo.pracownik_id
             JOIN uzytkownicy o ON o.id = oo.oceniajacy_id
             ${whereSql}
             ORDER BY
                CASE WHEN so.decyzja_dyrektora = 'OCZEKUJE' THEN 0 ELSE 1 END ASC,
                so.id DESC;`,
            params
        );

        const appeals = rowsRes.rows.map((r) => ({
            ...r,
            decyzja_label: APPEAL_DECISION_LABELS[r.decyzja_dyrektora] || r.decyzja_dyrektora,
            po_terminie_ustawowym: r.data_zapoznania_z_ocena
                ? diffDaysIso(r.data_zapoznania_z_ocena, r.data_zlozenia) > LEGAL_CONFIG.appealDaysLimit
                : false,
        }));

        res.json({ appeals });
    })
);

router.post(
    '/evaluations/:evalId/appeals',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const { uzasadnienie_pracownika } = req.body || {};
        const reason = String(uzasadnienie_pracownika || '').trim();
        if (!reason) {
            throw new HttpError(400, 'Wpisz uzasadnienie sprzeciwu przed wysłaniem.');
        }

        const result = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            if (req.currentUser.id !== evalRow.pracownik_id) {
                throw new HttpError(403, 'Tylko oceniany pracownik może złożyć sprzeciw od własnej oceny.');
            }
            if (evalRow.status !== 'ZAKONCZONA') {
                throw new HttpError(400, 'Sprzeciw można złożyć wyłącznie od zakończonej oceny.');
            }

            const existingRes = await client.query(
                "SELECT 1 FROM sprzeciwy_odwolania WHERE ocena_id = $1 AND decyzja_dyrektora = 'OCZEKUJE';",
                [evalId]
            );
            if (existingRes.rows.length > 0) {
                throw new HttpError(409, 'Dla tej oceny istnieje już nierozpatrzony sprzeciw.');
            }

            const dataZlozenia = todayIso();
            const terminRozpatrzenia = addDaysIso(dataZlozenia, LEGAL_CONFIG.appealReviewDaysLimit);
            const pastStatutoryDeadline = evalRow.data_zapoznania_z_ocena
                ? diffDaysIso(evalRow.data_zapoznania_z_ocena, dataZlozenia) > LEGAL_CONFIG.appealDaysLimit
                : false;

            if (process.env.STRICT_DEADLINES === 'true' && pastStatutoryDeadline) {
                throw new HttpError(
                    400,
                    `Minął ustawowy ${LEGAL_CONFIG.appealDaysLimit}-dniowy termin na złożenie sprzeciwu.`
                );
            }

            const insRes = await client.query(
                `INSERT INTO sprzeciwy_odwolania (
                    ocena_id, data_zlozenia, uzasadnienie_pracownika, termin_rozpatrzenia, decyzja_dyrektora
                 ) VALUES ($1, $2, $3, $4, 'OCZEKUJE')
                 RETURNING *;`,
                [evalId, dataZlozenia, reason, terminRozpatrzenia]
            );

            await client.query(
                `UPDATE oceny_okresowe
                 SET status = 'ODWOLANIE_W_TOKU', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1;`,
                [evalId]
            );

            return {
                appeal: {
                    ...insRes.rows[0],
                    decyzja_label: APPEAL_DECISION_LABELS.OCZEKUJE,
                    po_terminie_ustawowym: pastStatutoryDeadline,
                },
            };
        });

        res.status(201).json(result);
    })
);

router.patch(
    '/appeals/:id/decide',
    requireRole('DYREKTOR'),
    asyncHandler(async (req, res) => {
        const appealId = Number(req.params.id);
        if (!Number.isInteger(appealId) || appealId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID odwołania.');
        }

        const { decyzja_dyrektora, uzasadnienie_decyzji = '' } = req.body || {};

        if (!APPEAL_DECISIONS.has(decyzja_dyrektora)) {
            throw new HttpError(
                400,
                'Nieprawidłowa decyzja Dyrektora (dozwolone: ODRZUCONY, UWZGLEDNIONY_ZMIANA, UWZGLEDNIONY_PONOWNA_OCENA, NIEROZPATRZONY_W_TERMINIE).'
            );
        }

        const result = await withTransaction(async (client) => {
            const appRes = await client.query('SELECT * FROM sprzeciwy_odwolania WHERE id = $1;', [appealId]);
            if (appRes.rows.length === 0) {
                throw new HttpError(404, 'Sprzeciw nie istnieje.');
            }
            const appeal = appRes.rows[0];
            if (appeal.decyzja_dyrektora !== 'OCZEKUJE') {
                throw new HttpError(400, 'Ten sprzeciw został już rozpatrzony.');
            }

            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [appeal.ocena_id]);
            const oldEval = evalRes.rows[0];

            const updAppealRes = await client.query(
                `UPDATE sprzeciwy_odwolania
                 SET
                    decyzja_dyrektora = $1,
                    uzasadnienie_decyzji = $2,
                    data_decyzji = CURRENT_DATE
                 WHERE id = $3
                 RETURNING *;`,
                [decyzja_dyrektora, String(uzasadnienie_decyzji || '').trim() || null, appealId]
            );

            let updatedOldEval = oldEval;
            let newEvaluation = null;

            if (decyzja_dyrektora === 'ODRZUCONY') {
                const resEval = await client.query(
                    `UPDATE oceny_okresowe
                     SET status = 'ZAKONCZONA', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                     RETURNING *;`,
                    [oldEval.id]
                );
                updatedOldEval = resEval.rows[0];
            } else if (decyzja_dyrektora === 'UWZGLEDNIONY_ZMIANA') {
                // Cofnięcie oceny do oceniającego w celu naniesienia poprawki
                const resEval = await client.query(
                    `UPDATE oceny_okresowe
                     SET
                        status = 'PRZED_ROZMOWA_OCENIAJACA',
                        podpis_ocena_oceniajacy_at = NULL,
                        podpis_ocena_oceniany_at = NULL,
                        data_zapoznania_z_ocena = NULL,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                     RETURNING *;`,
                    [oldEval.id]
                );
                updatedOldEval = resEval.rows[0];
            } else {
                // UWZGLEDNIONY_PONOWNA_OCENA or NIEROZPATRZONY_W_TERMINIE
                const resEval = await client.query(
                    `UPDATE oceny_okresowe
                     SET status = 'UNIEWAZNIONA', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1
                     RETURNING *;`,
                    [oldEval.id]
                );
                updatedOldEval = resEval.rows[0];

                const oldCritRows = (
                    await client.query(
                        'SELECT kryterium_id FROM ocena_kryteria_wyniki WHERE ocena_id = $1 ORDER BY id ASC;',
                        [oldEval.id]
                    )
                ).rows;

                const spawnedRow = await createActiveCycle(client, {
                    pracownikId: oldEval.pracownik_id,
                    oceniajacyId: oldEval.oceniajacy_id,
                    typArkusza: oldEval.typ_arkusza,
                    startDate: oldEval.data_rozpoczecia_cyklu,
                    isAfterNegative: oldEval.wynik_ogolny === 'NEGATYWNA',
                    numerPodejscia: oldEval.numer_podejscia + 1,
                    poprzedniaOcenaId: oldEval.id,
                    status: 'PRZED_ROZMOWA_OCENIAJACA',
                    criteriaIdsOverride: oldCritRows.map((c) => c.kryterium_id),
                });
                newEvaluation = await hydrateEvaluation(client, spawnedRow, { includePrivateTasks: true });
            }

            return {
                appeal: {
                    ...updAppealRes.rows[0],
                    decyzja_label: APPEAL_DECISION_LABELS[decyzja_dyrektora],
                },
                evaluation: await hydrateEvaluation(client, updatedOldEval, { includePrivateTasks: true }),
                newEvaluation,
            };
        });

        res.json(result);
    })
);

module.exports = router;
