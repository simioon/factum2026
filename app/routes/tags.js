const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireRole } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const ALLOWED_CATEGORIES = new Set(['KOMPETENCYJNY', 'DOBROSTAN']);

function formatTagRow(row) {
    return {
        id: row.id,
        nazwa: row.nazwa,
        kategoria: row.kategoria,
        opis: row.opis,
        czy_aktywny: Boolean(row.czy_aktywny),
        isWellbeing: row.kategoria === 'DOBROSTAN',
        label: row.opis ? `${row.nazwa} (${row.opis})` : row.nazwa,
        criteriaIds: (row.criteria_ids || []).map(Number),
        usageCount: Number(row.usage_count || 0),
    };
}

async function fetchTags(db, { id = null, includeInactive = true } = {}) {
    const conditions = [];
    const params = [];

    if (id !== null) {
        params.push(id);
        conditions.push(`st.id = $${params.length}`);
    }
    if (!includeInactive) {
        conditions.push('st.czy_aktywny = TRUE');
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await db.query(
        `SELECT
            st.id,
            st.nazwa,
            st.kategoria,
            st.opis,
            st.czy_aktywny,
            COALESCE(
                ARRAY_AGG(DISTINCT tk.kryterium_id ORDER BY tk.kryterium_id)
                    FILTER (WHERE tk.kryterium_id IS NOT NULL),
                '{}'
            ) AS criteria_ids,
            COUNT(DISTINCT zt.id)::int AS usage_count
         FROM slownik_tagow st
         LEFT JOIN tag_kryteria tk ON tk.tag_id = st.id
         LEFT JOIN zadanie_tagi zt ON zt.tag_id = st.id
         ${whereSql}
         GROUP BY st.id
         ORDER BY st.czy_aktywny DESC, st.id ASC;`,
        params
    );

    return res.rows.map(formatTagRow);
}

async function validateTagPayload(client, body, { excludeTagId = null } = {}) {
    const {
        nazwa,
        kategoria = 'KOMPETENCYJNY',
        opis = '',
        criteriaIds = [],
    } = body || {};

    const trimmedName = String(nazwa || '').trim();
    if (!trimmedName) {
        throw new HttpError(400, 'Nazwa tagu jest wymagana.');
    }
    if (trimmedName.length > 60) {
        throw new HttpError(400, 'Nazwa tagu może mieć maksymalnie 60 znaków.');
    }
    if (!ALLOWED_CATEGORIES.has(kategoria)) {
        throw new HttpError(400, 'Nieprawidłowa kategoria tagu (dozwolone: KOMPETENCYJNY, DOBROSTAN).');
    }

    const dupRes = await client.query(
        `SELECT id, czy_aktywny
         FROM slownik_tagow
         WHERE LOWER(nazwa) = LOWER($1) AND ($2::int IS NULL OR id <> $2::int)
         LIMIT 1;`,
        [trimmedName, excludeTagId]
    );
    if (dupRes.rows.length > 0) {
        const dup = dupRes.rows[0];
        if (dup.czy_aktywny) {
            throw new HttpError(409, 'Tag o tej nazwie już istnieje w słowniku.');
        }
        throw new HttpError(
            409,
            'Istnieje już wycofany tag o tej nazwie — przywróć go z archiwum lub zmień jego nazwę.'
        );
    }

    let normalizedCriteriaIds = [];
    if (kategoria === 'KOMPETENCYJNY') {
        if (!Array.isArray(criteriaIds)) {
            throw new HttpError(400, 'Pole criteriaIds musi być tablicą identyfikatorów kryteriów.');
        }
        const uniqueIds = [...new Set(criteriaIds.map((x) => Number(x)))];
        if (uniqueIds.some((x) => !Number.isInteger(x) || x <= 0)) {
            throw new HttpError(400, 'Nieprawidłowe ID kryterium na liście powiązań.');
        }
        if (uniqueIds.length === 0) {
            throw new HttpError(400, 'Tag kompetencyjny musi być przypisany do co najmniej jednego kryterium oceny.');
        }

        const critRes = await client.query(
            `SELECT id, czy_aktywne
             FROM slownik_kryteriow
             WHERE id = ANY($1::int[]);`,
            [uniqueIds]
        );
        const activeCritSet = new Set(
            critRes.rows.filter((r) => r.czy_aktywne).map((r) => r.id)
        );
        for (const cid of uniqueIds) {
            if (!activeCritSet.has(cid)) {
                throw new HttpError(
                    400,
                    `Kryterium ID ${cid} nie istnieje lub zostało wycofane z aktywnego słownika.`
                );
            }
        }
        normalizedCriteriaIds = uniqueIds.sort((a, b) => a - b);
    }

    return {
        nazwa: trimmedName,
        kategoria,
        opis: String(opis || '').trim() || null,
        criteriaIds: normalizedCriteriaIds,
    };
}

router.get(
    '/tags',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const includeInactive = req.query.includeInactive !== 'false';
        const tags = await fetchTags({ query }, { includeInactive });
        res.json({ tags });
    })
);

router.post(
    '/tags',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const tag = await withTransaction(async (client) => {
            const payload = await validateTagPayload(client, req.body);

            const insRes = await client.query(
                `INSERT INTO slownik_tagow (nazwa, kategoria, opis, czy_aktywny)
                 VALUES ($1, $2, $3, TRUE)
                 RETURNING id;`,
                [payload.nazwa, payload.kategoria, payload.opis]
            );
            const tagId = insRes.rows[0].id;

            for (const critId of payload.criteriaIds) {
                await client.query(
                    `INSERT INTO tag_kryteria (tag_id, kryterium_id)
                     VALUES ($1, $2)
                     ON CONFLICT (tag_id, kryterium_id) DO NOTHING;`,
                    [tagId, critId]
                );
            }

            const rows = await fetchTags(client, { id: tagId });
            return rows[0];
        });

        res.status(201).json({ tag });
    })
);

router.put(
    '/tags/:id',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const tagId = Number(req.params.id);
        if (!Number.isInteger(tagId) || tagId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID tagu.');
        }

        const tag = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT * FROM slownik_tagow WHERE id = $1;', [tagId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Tag nie istnieje w słowniku.');
            }

            const payload = await validateTagPayload(client, req.body, { excludeTagId: tagId });
            const hasActiveFlag =
                req.body && Object.prototype.hasOwnProperty.call(req.body, 'czy_aktywny') && typeof req.body.czy_aktywny === 'boolean';
            const nextActive = hasActiveFlag ? req.body.czy_aktywny : existingRes.rows[0].czy_aktywny;

            await client.query(
                `UPDATE slownik_tagow
                 SET nazwa = $1, kategoria = $2, opis = $3, czy_aktywny = $4
                 WHERE id = $5;`,
                [payload.nazwa, payload.kategoria, payload.opis, nextActive, tagId]
            );

            await client.query('DELETE FROM tag_kryteria WHERE tag_id = $1;', [tagId]);
            for (const critId of payload.criteriaIds) {
                await client.query(
                    `INSERT INTO tag_kryteria (tag_id, kryterium_id)
                     VALUES ($1, $2)
                     ON CONFLICT (tag_id, kryterium_id) DO NOTHING;`,
                    [tagId, critId]
                );
            }

            const rows = await fetchTags(client, { id: tagId });
            return rows[0];
        });

        res.json({ tag });
    })
);

router.delete(
    '/tags/:id',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const tagId = Number(req.params.id);
        if (!Number.isInteger(tagId) || tagId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID tagu.');
        }

        const tag = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT id FROM slownik_tagow WHERE id = $1;', [tagId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Tag nie istnieje w słowniku.');
            }

            // Non-destructive soft-delete: keeps slownik_tagow, tag_kryteria, and zadanie_tagi intact
            await client.query(
                'UPDATE slownik_tagow SET czy_aktywny = FALSE WHERE id = $1;',
                [tagId]
            );

            const rows = await fetchTags(client, { id: tagId });
            return rows[0];
        });

        res.json({ archived: true, tag });
    })
);

router.patch(
    '/tags/:id/restore',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const tagId = Number(req.params.id);
        if (!Number.isInteger(tagId) || tagId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID tagu.');
        }

        const tag = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT id FROM slownik_tagow WHERE id = $1;', [tagId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Tag nie istnieje w słowniku.');
            }

            await client.query(
                'UPDATE slownik_tagow SET czy_aktywny = TRUE WHERE id = $1;',
                [tagId]
            );

            const rows = await fetchTags(client, { id: tagId });
            return rows[0];
        });

        res.json({ restored: true, tag });
    })
);

module.exports = router;
