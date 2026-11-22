const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireUser, requireRole } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { RANK_STATUS_LABELS } = require('../domain/legalRules');

const router = express.Router();

const ALLOWED_RANK_DECISIONS = new Set(['ZATWIERDZONY', 'ODRZUCONY']);

router.get(
    '/rank-requests',
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
                wss.*,
                oo.pracownik_id,
                oo.oceniajacy_id,
                oo.srednia_punktow,
                oo.wynik_ogolny,
                p.imie_nazwisko AS pracownik_nazwa,
                p.aktualny_stopien_sluzbowy AS obecny_stopien,
                o.imie_nazwisko AS oceniajacy_nazwa
             FROM wnioski_stopien_sluzbowy wss
             JOIN oceny_okresowe oo ON oo.id = wss.ocena_id
             JOIN uzytkownicy p ON p.id = oo.pracownik_id
             JOIN uzytkownicy o ON o.id = oo.oceniajacy_id
             ${whereSql}
             ORDER BY
                CASE WHEN wss.status_decyzji = 'OCZEKUJE' THEN 0 ELSE 1 END ASC,
                wss.id DESC;`,
            params
        );

        const rankRequests = rowsRes.rows.map((r) => ({
            ...r,
            status_label: RANK_STATUS_LABELS[r.status_decyzji] || r.status_decyzji,
        }));

        res.json({ rankRequests });
    })
);

router.patch(
    '/rank-requests/:id/decide',
    requireRole('DYREKTOR'),
    asyncHandler(async (req, res) => {
        const reqId = Number(req.params.id);
        if (!Number.isInteger(reqId) || reqId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID wniosku o stopień służbowy.');
        }

        const { status_decyzji, motywacja_dyrektora = '' } = req.body || {};
        if (!ALLOWED_RANK_DECISIONS.has(status_decyzji)) {
            throw new HttpError(400, 'Nieprawidłowa decyzja (dozwolone: ZATWIERDZONY, ODRZUCONY).');
        }
        const trimmedMotivation = String(motywacja_dyrektora || '').trim();
        if (status_decyzji === 'ODRZUCONY' && !trimmedMotivation) {
            throw new HttpError(
                400,
                'Uzasadnienie decyzji jest obowiązkowe przy odrzuceniu wniosku o stopień służbowy.'
            );
        }

        const result = await withTransaction(async (client) => {
            const rrRes = await client.query(
                `SELECT wss.*, oo.pracownik_id
                 FROM wnioski_stopien_sluzbowy wss
                 JOIN oceny_okresowe oo ON oo.id = wss.ocena_id
                 WHERE wss.id = $1;`,
                [reqId]
            );
            if (rrRes.rows.length === 0) {
                throw new HttpError(404, 'Wniosek o stopień służbowy nie istnieje.');
            }
            const rr = rrRes.rows[0];
            if (rr.status_decyzji !== 'OCZEKUJE') {
                throw new HttpError(400, 'Ten wniosek został już rozpatrzony.');
            }

            const updRes = await client.query(
                `UPDATE wnioski_stopien_sluzbowy
                 SET
                    status_decyzji = $1,
                    motywacja_dyrektora = $2,
                    data_decyzji = CURRENT_DATE
                 WHERE id = $3
                 RETURNING *;`,
                [status_decyzji, String(motywacja_dyrektora || '').trim() || null, reqId]
            );

            let updatedRank = null;
            if (status_decyzji === 'ZATWIERDZONY') {
                const empUpd = await client.query(
                    `UPDATE uzytkownicy
                     SET aktualny_stopien_sluzbowy = $1
                     WHERE id = $2
                     RETURNING aktualny_stopien_sluzbowy;`,
                    [rr.wnioskowany_stopien, rr.pracownik_id]
                );
                updatedRank = empUpd.rows[0].aktualny_stopien_sluzbowy;
            }

            return {
                rankRequest: {
                    ...updRes.rows[0],
                    status_label: RANK_STATUS_LABELS[status_decyzji],
                },
                newRank: updatedRank,
            };
        });

        res.json(result);
    })
);

module.exports = router;
