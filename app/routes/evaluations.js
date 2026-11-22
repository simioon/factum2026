const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireUser } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const {
    ACTIVE_STATUSES,
    EDITABLE_SETUP_STATUSES,
    createActiveCycle,
    hydrateEvaluation,
    assertCanViewEvaluation,
    assertCanEvaluate,
} = require('../db/evaluationService');
const {
    LEGAL_CONFIG,
    LEVEL_LABELS,
    STATUS_LABELS,
    calculateFinalResult,
    checkAutoRankPromotion,
} = require('../domain/legalRules');

const router = express.Router();

router.get(
    '/evaluations',
    requireUser,
    asyncHandler(async (req, res) => {
        const { pracownikId, oceniajacyId, status, completedOnly } = req.query;
        const conditions = [];
        const params = [];

        if (req.currentUser.rola === 'OCENIANY') {
            params.push(req.currentUser.id);
            conditions.push(`oo.pracownik_id = $${params.length}`);
        } else if (req.currentUser.rola === 'OCENIAJACY') {
            params.push(req.currentUser.id);
            conditions.push(`(oo.oceniajacy_id = $${params.length} OR oo.pracownik_id = $${params.length})`);
        }

        if (pracownikId) {
            params.push(Number(pracownikId));
            conditions.push(`oo.pracownik_id = $${params.length}`);
        }
        if (oceniajacyId) {
            params.push(Number(oceniajacyId));
            conditions.push(`oo.oceniajacy_id = $${params.length}`);
        }
        if (status) {
            params.push(String(status));
            conditions.push(`oo.status = $${params.length}`);
        } else if (completedOnly === 'true') {
            conditions.push(
                "oo.status IN ('SPORZADZONA_DO_PODPISU', 'ZAKONCZONA', 'ODWOLANIE_W_TOKU', 'UNIEWAZNIONA')"
            );
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const evalsRes = await query(
            `SELECT
                oo.*,
                p.imie_nazwisko AS pracownik_nazwa,
                p.nazwa_stanowiska AS pracownik_stanowisko,
                o.imie_nazwisko AS oceniajacy_nazwa,
                o.nazwa_stanowiska AS oceniajacy_stanowisko
             FROM oceny_okresowe oo
             JOIN uzytkownicy p ON p.id = oo.pracownik_id
             JOIN uzytkownicy o ON o.id = oo.oceniajacy_id
             ${whereSql}
             ORDER BY COALESCE(oo.data_rozmowy_oceniajacej, oo.updated_at::date) DESC, oo.id DESC;`,
            params
        );

        const evalIds = evalsRes.rows.map((r) => r.id);
        const criteriaByEval = new Map();
        const appealsByEval = new Map();

        if (evalIds.length > 0) {
            const [critRes, appRes] = await Promise.all([
                query(
                    `SELECT okw.ocena_id, okw.kryterium_id, okw.punkty, okw.komentarz_czastkowy, sk.nazwa
                     FROM ocena_kryteria_wyniki okw
                     JOIN slownik_kryteriow sk ON sk.id = okw.kryterium_id
                     WHERE okw.ocena_id = ANY($1::int[])
                     ORDER BY okw.id ASC;`,
                    [evalIds]
                ),
                query(
                    `SELECT * FROM sprzeciwy_odwolania
                     WHERE ocena_id = ANY($1::int[])
                     ORDER BY id DESC;`,
                    [evalIds]
                ),
            ]);
            for (const row of critRes.rows) {
                if (!criteriaByEval.has(row.ocena_id)) criteriaByEval.set(row.ocena_id, []);
                criteriaByEval.get(row.ocena_id).push(row);
            }
            for (const row of appRes.rows) {
                if (!appealsByEval.has(row.ocena_id)) appealsByEval.set(row.ocena_id, []);
                appealsByEval.get(row.ocena_id).push(row);
            }
        }

        const evaluations = evalsRes.rows.map((ev) => ({
            ...ev,
            status_label: STATUS_LABELS[ev.status] || ev.status,
            poziom_oceny_label: ev.poziom_oceny ? LEVEL_LABELS[ev.poziom_oceny] || ev.poziom_oceny : null,
            criteria: criteriaByEval.get(ev.id) || [],
            appeals: appealsByEval.get(ev.id) || [],
        }));

        res.json({ evaluations });
    })
);

router.get(
    '/evaluations/:id',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const evalRes = await query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
        if (evalRes.rows.length === 0) {
            throw new HttpError(404, 'Ocena okresowa nie istnieje.');
        }
        const evalRow = evalRes.rows[0];
        assertCanViewEvaluation(req.currentUser, evalRow);

        const includePrivateTasks = req.currentUser.id !== evalRow.pracownik_id;
        const evaluation = await hydrateEvaluation({ query }, evalRow, { includePrivateTasks });
        res.json({ evaluation });
    })
);

router.put(
    '/evaluations/:id/setup',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const {
            data_rozmowy_wstepnej = null,
            oczekiwania_i_cele = '',
            additionalCriteriaIds = [],
            signByEvaluator = false,
        } = req.body || {};

        if (!Array.isArray(additionalCriteriaIds)) {
            throw new HttpError(400, 'Pole additionalCriteriaIds musi być tablicą.');
        }

        const uniqueAdditional = [...new Set(additionalCriteriaIds.map((x) => Number(x)))];
        if (uniqueAdditional.some((x) => !Number.isInteger(x) || x <= 0)) {
            throw new HttpError(400, 'Nieprawidłowe ID kryterium dodatkowego.');
        }
        if (uniqueAdditional.length > LEGAL_CONFIG.maxAdditionalCriteria) {
            throw new HttpError(
                400,
                `Możesz wybrać maksymalnie ${LEGAL_CONFIG.maxAdditionalCriteria} kryteria dodatkowe.`
            );
        }

        const updated = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            assertCanEvaluate(req.currentUser, evalRow);

            if (!EDITABLE_SETUP_STATUSES.includes(evalRow.status)) {
                throw new HttpError(400, `Nie można edytować kryteriów w statusie ${evalRow.status}.`);
            }
            if (evalRow.podpis_kryteria_oceniajacy_at) {
                throw new HttpError(
                    409,
                    'Część I została już podpisana elektronicznie — kryteria i ustalenia rozmowy wstępnej nie mogą być zmieniane.'
                );
            }

            const sheetCritRes = await client.query(
                `SELECT ak.kryterium_id, ak.typ_kryterium
                 FROM arkusz_kryteria ak
                 JOIN slownik_kryteriow sk ON sk.id = ak.kryterium_id
                 WHERE ak.kod_arkusza = $1 AND sk.czy_aktywne = TRUE;`,
                [evalRow.typ_arkusza]
            );
            const mandatoryIds = sheetCritRes.rows
                .filter((r) => r.typ_kryterium === 'OBOWIAZKOWE')
                .map((r) => r.kryterium_id);
            const allowedAdditionalSet = new Set(
                sheetCritRes.rows
                    .filter((r) => r.typ_kryterium === 'DODATKOWE')
                    .map((r) => r.kryterium_id)
            );

            for (const addId of uniqueAdditional) {
                if (!allowedAdditionalSet.has(addId)) {
                    throw new HttpError(
                        400,
                        `Kryterium ${addId} nie jest dozwolonym kryterium dodatkowym dla Arkusza ${evalRow.typ_arkusza}.`
                    );
                }
            }

            const targetCriteriaIds = [...mandatoryIds, ...uniqueAdditional];
            await client.query(
                `DELETE FROM ocena_kryteria_wyniki
                 WHERE ocena_id = $1 AND NOT (kryterium_id = ANY($2::int[]));`,
                [evalId, targetCriteriaIds]
            );

            for (const critId of targetCriteriaIds) {
                await client.query(
                    `INSERT INTO ocena_kryteria_wyniki (ocena_id, kryterium_id, punkty)
                     VALUES ($1, $2, NULL)
                     ON CONFLICT (ocena_id, kryterium_id) DO NOTHING;`,
                    [evalId, critId]
                );
            }

            let nextStatus = evalRow.status;
            if (signByEvaluator) {
                nextStatus = evalRow.podpis_kryteria_oceniany_at
                    ? 'W_TRAKCIE_OKRESU'
                    : 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW';
            }

            const updRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    data_rozmowy_wstepnej = $1,
                    oczekiwania_i_cele = $2,
                    podpis_kryteria_oceniajacy_at = CASE
                        WHEN $3::boolean THEN COALESCE(podpis_kryteria_oceniajacy_at, CURRENT_TIMESTAMP)
                        ELSE podpis_kryteria_oceniajacy_at
                    END,
                    status = $4,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5
                 RETURNING *;`,
                [
                    data_rozmowy_wstepnej ? String(data_rozmowy_wstepnej) : null,
                    String(oczekiwania_i_cele || '').trim() || null,
                    Boolean(signByEvaluator),
                    nextStatus,
                    evalId,
                ]
            );

            return hydrateEvaluation(client, updRes.rows[0], { includePrivateTasks: true });
        });

        res.json({ evaluation: updated });
    })
);

router.post(
    '/evaluations/:id/sign-criteria',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const updated = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            if (req.currentUser.id !== evalRow.pracownik_id) {
                throw new HttpError(403, 'Tylko oceniany pracownik może podpisać kryteria oceny.');
            }
            if (!evalRow.podpis_kryteria_oceniajacy_at) {
                throw new HttpError(400, 'Oceniający musi najpierw zatwierdzić kryteria (e-podpis Części I).');
            }

            const nextStatus = ['WYZNACZANIE_KRYTERIOW', 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW'].includes(
                evalRow.status
            )
                ? 'W_TRAKCIE_OKRESU'
                : evalRow.status;

            const updRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    podpis_kryteria_oceniany_at = COALESCE(podpis_kryteria_oceniany_at, CURRENT_TIMESTAMP),
                    status = $1,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *;`,
                [nextStatus, evalId]
            );

            return hydrateEvaluation(client, updRes.rows[0], { includePrivateTasks: false });
        });

        res.json({ evaluation: updated });
    })
);

router.post(
    '/evaluations/:id/start-review',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const { data_rozmowy_oceniajacej = null } = req.body || {};

        const updated = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            assertCanEvaluate(req.currentUser, evalRow);

            if (!EDITABLE_SETUP_STATUSES.includes(evalRow.status)) {
                throw new HttpError(400, `Nie można rozpocząć rozmowy oceniającej w statusie ${evalRow.status}.`);
            }

            const updRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    status = 'PRZED_ROZMOWA_OCENIAJACA',
                    data_rozmowy_oceniajacej = COALESCE($1::date, data_rozmowy_oceniajacej),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *;`,
                [data_rozmowy_oceniajacej, evalId]
            );

            return hydrateEvaluation(client, updRes.rows[0], { includePrivateTasks: true });
        });

        res.json({ evaluation: updated });
    })
);

router.post(
    '/evaluations/:id/finalize',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const {
            scores = {},
            uzasadnienie_oceny = '',
            wnioski_iprz = '',
            data_rozmowy_oceniajacej = null,
            requestRankPromotion = false,
            rankPromotionMotivation = '',
        } = req.body || {};

        const result = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            assertCanEvaluate(req.currentUser, evalRow);

            if (!EDITABLE_SETUP_STATUSES.includes(evalRow.status)) {
                throw new HttpError(
                    400,
                    `Ocena została już sporządzona lub zamknięta (status: ${evalRow.status}).`
                );
            }

            const critRows = (
                await client.query(
                    'SELECT kryterium_id FROM ocena_kryteria_wyniki WHERE ocena_id = $1 ORDER BY id ASC;',
                    [evalId]
                )
            ).rows;
            if (critRows.length === 0) {
                throw new HttpError(400, 'Brak kryteriów przypisanych do tej oceny.');
            }

            const scoreValues = [];
            const normalizedCriteriaUpdates = [];
            for (const row of critRows) {
                const rawEntry = scores[row.kryterium_id] ?? scores[String(row.kryterium_id)];
                if (rawEntry === undefined || rawEntry === null) {
                    throw new HttpError(
                        400,
                        `Brak oceny punktowej dla kryterium ID ${row.kryterium_id}.`
                    );
                }
                const punkty = typeof rawEntry === 'object' ? Number(rawEntry.punkty) : Number(rawEntry);
                const komentarz =
                    typeof rawEntry === 'object' && rawEntry.komentarz_czastkowy
                        ? String(rawEntry.komentarz_czastkowy).trim()
                        : null;
                scoreValues.push(punkty);
                normalizedCriteriaUpdates.push({
                    kryterium_id: row.kryterium_id,
                    punkty,
                    komentarz,
                });
            }

            let calc;
            try {
                calc = calculateFinalResult(scoreValues);
            } catch (err) {
                throw new HttpError(400, err.message);
            }

            const trimmedJustif = String(uzasadnienie_oceny || '').trim();
            if (calc.wynik_ogolny === 'NEGATYWNA' && !trimmedJustif) {
                throw new HttpError(
                    400,
                    'Blokada podpisu: przy ocenie NEGATYWNEJ uzasadnienie oceny jest obowiązkowe!'
                );
            }

            for (const item of normalizedCriteriaUpdates) {
                await client.query(
                    `UPDATE ocena_kryteria_wyniki
                     SET punkty = $1, komentarz_czastkowy = COALESCE($2, komentarz_czastkowy)
                     WHERE ocena_id = $3 AND kryterium_id = $4;`,
                    [item.punkty, item.komentarz, evalId, item.kryterium_id]
                );
            }

            const updRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    srednia_punktow = $1,
                    poziom_oceny = $2,
                    wynik_ogolny = $3,
                    uzasadnienie_oceny = $4,
                    wnioski_iprz = $5,
                    data_rozmowy_oceniajacej = COALESCE($6::date, CURRENT_DATE),
                    podpis_ocena_oceniajacy_at = CURRENT_TIMESTAMP,
                    status = 'SPORZADZONA_DO_PODPISU',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7
                 RETURNING *;`,
                [
                    calc.srednia_punktow,
                    calc.poziom_oceny,
                    calc.wynik_ogolny,
                    trimmedJustif || null,
                    String(wnioski_iprz || '').trim() || null,
                    data_rozmowy_oceniajacej,
                    evalId,
                ]
            );

            // Check whether automatic obligatory promotion applies upon employee acknowledgement
            const empRow = (
                await client.query(
                    'SELECT id, aktualny_stopien_sluzbowy FROM uzytkownicy WHERE id = $1;',
                    [evalRow.pracownik_id]
                )
            ).rows[0];
            const prevEvalRes = await client.query(
                `SELECT id, srednia_punktow, wynik_ogolny
                 FROM oceny_okresowe
                 WHERE pracownik_id = $1 AND id <> $2 AND status = 'ZAKONCZONA'
                 ORDER BY COALESCE(data_zapoznania_z_ocena, data_rozmowy_oceniajacej, created_at::date) DESC, id DESC
                 LIMIT 1;`,
                [evalRow.pracownik_id, evalId]
            );
            const autoPromotionEligible = checkAutoRankPromotion(
                empRow.aktualny_stopien_sluzbowy,
                calc,
                prevEvalRes.rows[0] || null
            );

            if (
                requestRankPromotion &&
                !autoPromotionEligible &&
                calc.wynik_ogolny === 'POZYTYWNA' &&
                empRow.aktualny_stopien_sluzbowy >= 1 &&
                empRow.aktualny_stopien_sluzbowy < 9
            ) {
                const existingReq = await client.query(
                    "SELECT 1 FROM wnioski_stopien_sluzbowy WHERE ocena_id = $1 AND status_decyzji = 'OCZEKUJE';",
                    [evalId]
                );
                if (existingReq.rows.length === 0) {
                    await client.query(
                        `INSERT INTO wnioski_stopien_sluzbowy (
                            ocena_id, tryb_przyznania, wnioskowany_stopien,
                            umotywowanie_przelozonego, status_decyzji
                        ) VALUES ($1, 'FAKULTATYWNY', $2, $3, 'OCZEKUJE');`,
                        [
                            evalId,
                            empRow.aktualny_stopien_sluzbowy + 1,
                            String(rankPromotionMotivation || '').trim() ||
                                trimmedJustif ||
                                'Pozytywna ocena okresowa oraz wysokie zaangażowanie.',
                        ]
                    );
                }
            }

            const evaluation = await hydrateEvaluation(client, updRes.rows[0], {
                includePrivateTasks: true,
            });
            return { evaluation, autoRankPromotionPending: autoPromotionEligible };
        });

        res.json(result);
    })
);

router.post(
    '/evaluations/:id/acknowledge',
    requireUser,
    asyncHandler(async (req, res) => {
        const evalId = Number(req.params.id);
        if (!Number.isInteger(evalId) || evalId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID oceny.');
        }

        const result = await withTransaction(async (client) => {
            const evalRes = await client.query('SELECT * FROM oceny_okresowe WHERE id = $1;', [evalId]);
            if (evalRes.rows.length === 0) {
                throw new HttpError(404, 'Ocena okresowa nie istnieje.');
            }
            const evalRow = evalRes.rows[0];
            if (req.currentUser.id !== evalRow.pracownik_id) {
                throw new HttpError(403, 'Tylko oceniany pracownik może potwierdzić zapoznanie się z oceną.');
            }
            if (evalRow.status !== 'SPORZADZONA_DO_PODPISU') {
                throw new HttpError(
                    400,
                    `Ocena nie oczekuje na zapoznanie się (aktualny status: ${evalRow.status}).`
                );
            }

            const updRes = await client.query(
                `UPDATE oceny_okresowe
                 SET
                    podpis_ocena_oceniany_at = CURRENT_TIMESTAMP,
                    data_zapoznania_z_ocena = CURRENT_DATE,
                    status = 'ZAKONCZONA',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *;`,
                [evalId]
            );
            const completedEval = updRes.rows[0];

            // Check automatic obligatory rank promotion (two consecutive POZYTYWNA > 6 pkt)
            const empRes = await client.query(
                'SELECT id, arkusz, rola, aktualny_stopien_sluzbowy, przelozony_id FROM uzytkownicy WHERE id = $1;',
                [evalRow.pracownik_id]
            );
            const emp = empRes.rows[0];

            const prevRes = await client.query(
                `SELECT id, srednia_punktow, wynik_ogolny
                 FROM oceny_okresowe
                 WHERE pracownik_id = $1 AND id <> $2 AND status = 'ZAKONCZONA'
                 ORDER BY COALESCE(data_zapoznania_z_ocena, data_rozmowy_oceniajacej, created_at::date) DESC, id DESC
                 LIMIT 1;`,
                [evalRow.pracownik_id, evalId]
            );
            const prevEval = prevRes.rows[0] || null;

            let autoRankPromoted = false;
            let newRank = emp.aktualny_stopien_sluzbowy;
            if (checkAutoRankPromotion(emp.aktualny_stopien_sluzbowy, completedEval, prevEval)) {
                newRank = emp.aktualny_stopien_sluzbowy + 1;
                await client.query(
                    'UPDATE uzytkownicy SET aktualny_stopien_sluzbowy = $1 WHERE id = $2;',
                    [newRank, emp.id]
                );
                await client.query(
                    `INSERT INTO wnioski_stopien_sluzbowy (
                        ocena_id, tryb_przyznania, wnioskowany_stopien,
                        umotywowanie_przelozonego, status_decyzji, motywacja_dyrektora, data_decyzji
                    ) VALUES ($1, 'OBLIGATORYJNY', $2, $3, 'ZATWIERDZONY', $4, CURRENT_DATE);`,
                    [
                        evalId,
                        newRank,
                        'Awans obligatoryjny z mocy prawa — dwie kolejne oceny pozytywne powyżej 6 pkt.',
                        'Przyznano automatycznie zgodnie z ustawą o służbie cywilnej.',
                    ]
                );
                autoRankPromoted = true;
            }

            // Spawn next cycle only if no other active cycle already exists for this employee
            const existingActiveRes = await client.query(
                `SELECT id FROM oceny_okresowe
                 WHERE pracownik_id = $1 AND status = ANY($2::varchar[]) AND id <> $3
                 LIMIT 1;`,
                [emp.id, ACTIVE_STATUSES, evalId]
            );

            let nextEvaluation = null;
            if (existingActiveRes.rows.length === 0 && emp.przelozony_id && emp.arkusz && emp.rola !== 'DYREKTOR') {
                nextEvaluation = await createActiveCycle(client, {
                    pracownikId: emp.id,
                    oceniajacyId: emp.przelozony_id,
                    typArkusza: emp.arkusz,
                    isAfterNegative: completedEval.wynik_ogolny === 'NEGATYWNA',
                });
            }

            const evaluation = await hydrateEvaluation(client, completedEval, {
                includePrivateTasks: false,
            });
            return {
                evaluation,
                autoRankPromoted,
                newRank: newRank > 0 ? newRank : null,
                nextEvaluation,
            };
        });

        res.json(result);
    })
);

module.exports = router;
