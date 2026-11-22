const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireUser } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { assertCanViewEvaluation, assertCanEvaluate } = require('../db/evaluationService');
const { diffDaysIso } = require('../domain/legalRules');

const router = express.Router();

const ALLOWED_EVENT_TYPES = new Set([
    'NIEOBECNOSC_POWYZEJ_MIESIACA',
    'ZMIANA_STANOWISKA',
    'ZMIANA_OCENIAJACEGO',
    'INNE',
]);

router.get(
    '/evaluations/:evalId/hr-events',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const evalRes = await query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
        if (evalRes.rows.length === 0) {
            throw new HttpError(404, 'Ocena okresowa nie istnieje.');
        }
        assertCanViewEvaluation(req.currentUser, evalRes.rows[0]);

        const eventsRes = await query(
            `SELECT * FROM zdarzenia_kadrowe
             WHERE ocena_id = $1
             ORDER BY data_od DESC, id DESC;`,
            [evalId]
        );

        res.json({ events: eventsRes.rows });
    })
);

router.post(
    '/evaluations/:evalId/hr-events',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.evalId);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const {
            typ_zdarzenia,
            data_od,
            data_do = null,
            dni_przesuniecia_terminu,
            opis = '',
        } = req.body || {};

        if (!ALLOWED_EVENT_TYPES.has(typ_zdarzenia)) {
            throw new HttpError(400, 'Nieprawidłowy typ zdarzenia kadrowego.');
        }
        if (!data_od) {
            throw new HttpError(400, 'Pole data_od jest wymagane.');
        }

        let shiftDays;
        if (dni_przesuniecia_terminu !== undefined && dni_przesuniecia_terminu !== null && dni_przesuniecia_terminu !== '') {
            shiftDays = Number(dni_przesuniecia_terminu);
            if (!Number.isInteger(shiftDays) || shiftDays < 0) {
                throw new HttpError(400, 'Liczba dni przesunięcia terminu musi być liczbą całkowitą >= 0.');
            }
        } else if (typ_zdarzenia === 'NIEOBECNOSC_POWYZEJ_MIESIACA' && data_do) {
            const duration = diffDaysIso(String(data_od), String(data_do));
            if (duration === null || duration < 0) {
                throw new HttpError(400, 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
            }
            const inclusiveDays = duration + 1;
            shiftDays = inclusiveDays > 30 ? inclusiveDays : 0;
        } else {
            shiftDays = 0;
        }

        const result = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            assertCanEvaluate(req.currentUser, evalRow);

            const insRes = await client.query(
                `INSERT INTO zdarzenia_kadrowe (
                    ocena_id, typ_zdarzenia, data_od, data_do, dni_przesuniecia_terminu, opis
                 ) VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *;`,
                [
                    evalId,
                    typ_zdarzenia,
                    String(data_od),
                    data_do ? String(data_do) : null,
                    shiftDays,
                    String(opis || '').trim() || null,
                ]
            );

            const updEvalRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    planowana_data_oceny = planowana_data_oceny + $1::int,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING planowana_data_oceny;`,
                [shiftDays, evalId]
            );

            return {
                event: insRes.rows[0],
                planowana_data_oceny: updEvalRes.rows[0].planowana_data_oceny,
            };
        });

        res.status(201).json(result);
    })
);

router.delete(
    '/hr-events/:eventId',
    requireUser,
    asyncHandler(async (req, res) => {
        const eventId = Number(req.params.eventId);
        if (!Number.isInteger(eventId) || eventId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID zdarzenia kadrowego.');
        }

        const result = await withTransaction(async (client) => {
            const evRes = await client.query(
                `SELECT zk.*, oo.oceniajacy_id
                 FROM zdarzenia_kadrowe zk
                 JOIN oceny_okresowe oo ON oo.id = zk.ocena_id
                 WHERE zk.id = $1;`,
                [eventId]
            );
            if (evRes.rows.length === 0) {
                throw new HttpError(404, 'Zdarzenie kadrowe nie istnieje.');
            }
            const eventRow = evRes.rows[0];
            assertCanEvaluate(req.currentUser, { oceniajacy_id: eventRow.oceniajacy_id });

            await client.query('DELETE FROM zdarzenia_kadrowe WHERE id = $1;', [eventId]);

            const updEvalRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    planowana_data_oceny = planowana_data_oceny - $1::int,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING planowana_data_oceny;`,
                [eventRow.dni_przesuniecia_terminu, eventRow.ocena_id]
            );

            return {
                deleted: true,
                id: eventId,
                planowana_data_oceny: updEvalRes.rows[0].planowana_data_oceny,
            };
        });

        res.json(result);
    })
);

module.exports = router;
