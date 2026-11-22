const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    LEGAL_CONFIG,
    SCORE_SCALE,
    LEVEL_LABELS,
    STATUS_LABELS,
    APPEAL_DECISION_LABELS,
    RANK_STATUS_LABELS,
    EVENT_TYPE_LABELS,
    IPRZ_SUGGESTIONS_BY_CRITERION,
} = require('../domain/legalRules');

const router = express.Router();

router.get(
    '/dictionaries',
    asyncHandler(async (req, res) => {
        const [criteriaRes, sheetRes, tagsRes] = await Promise.all([
            query('SELECT id, nazwa, opis, czy_aktywne FROM slownik_kryteriow WHERE czy_aktywne = TRUE ORDER BY id ASC;'),
            query(`
                SELECT ak.kod_arkusza, ak.kryterium_id, ak.typ_kryterium
                FROM arkusz_kryteria ak
                JOIN slownik_kryteriow sk ON sk.id = ak.kryterium_id
                WHERE sk.czy_aktywne = TRUE
                ORDER BY ak.kod_arkusza ASC, ak.id ASC;
            `),
            query(`
                SELECT
                    st.id,
                    st.nazwa,
                    st.kategoria,
                    st.opis,
                    st.czy_aktywny,
                    COALESCE(
                        ARRAY_AGG(tk.kryterium_id ORDER BY tk.kryterium_id)
                            FILTER (WHERE tk.kryterium_id IS NOT NULL),
                        '{}'
                    ) AS criteria_ids
                FROM slownik_tagow st
                LEFT JOIN tag_kryteria tk ON tk.tag_id = st.id
                WHERE st.czy_aktywny = TRUE
                GROUP BY st.id
                ORDER BY st.id ASC;
            `),
        ]);

        const criteria = criteriaRes.rows.map((c) => ({
            id: c.id,
            nazwa: c.nazwa,
            opis: c.opis,
            descriptions: c.opis ? c.opis.split('\n').filter(Boolean) : [],
            czy_aktywne: c.czy_aktywne,
        }));

        const sheetCriteria = {
            A: { mandatoryIds: [], additionalIds: [] },
            B: { mandatoryIds: [], additionalIds: [] },
            C: { mandatoryIds: [], additionalIds: [] },
        };
        for (const row of sheetRes.rows) {
            const bucket = sheetCriteria[row.kod_arkusza];
            if (!bucket) continue;
            if (row.typ_kryterium === 'OBOWIAZKOWE') {
                bucket.mandatoryIds.push(row.kryterium_id);
            } else {
                bucket.additionalIds.push(row.kryterium_id);
            }
        }

        const tags = tagsRes.rows.map((t) => ({
            id: t.id,
            nazwa: t.nazwa,
            kategoria: t.kategoria,
            opis: t.opis,
            czy_aktywny: Boolean(t.czy_aktywny),
            isWellbeing: t.kategoria === 'DOBROSTAN',
            label: t.opis ? `${t.nazwa} (${t.opis})` : t.nazwa,
            criteriaIds: t.criteria_ids || [],
        }));

        res.json({
            criteria,
            sheetCriteria,
            tags,
            legalConfig: LEGAL_CONFIG,
            scoreScale: SCORE_SCALE,
            levelLabels: LEVEL_LABELS,
            statusLabels: STATUS_LABELS,
            appealDecisionLabels: APPEAL_DECISION_LABELS,
            rankStatusLabels: RANK_STATUS_LABELS,
            eventTypeLabels: EVENT_TYPE_LABELS,
            iprzSuggestions: IPRZ_SUGGESTIONS_BY_CRITERION,
        });
    })
);

module.exports = router;
