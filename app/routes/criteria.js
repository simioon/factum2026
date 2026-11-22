const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireRole } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const SHEET_CODES = ['A', 'B', 'C'];
const ALLOWED_SHEET_TYPES = new Set(['OBOWIAZKOWE', 'DODATKOWE']);

async function fetchCriteria(db, { id = null, includeInactive = true } = {}) {
    const conditions = [];
    const params = [];

    if (id !== null) {
        params.push(id);
        conditions.push(`sk.id = $${params.length}`);
    }
    if (!includeInactive) {
        conditions.push('sk.czy_aktywne = TRUE');
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const critRes = await db.query(
        `SELECT sk.id, sk.nazwa, sk.opis, sk.czy_aktywne
         FROM slownik_kryteriow sk
         ${whereSql}
         ORDER BY sk.czy_aktywne DESC, sk.id ASC;`,
        params
    );

    const critIds = critRes.rows.map((r) => r.id);
    const sheetsByCrit = new Map();
    const tagCountByCrit = new Map();
    const usageCountByCrit = new Map();

    if (critIds.length > 0) {
        const [sheetRes, tagRes, usageRes] = await Promise.all([
            db.query(
                `SELECT kod_arkusza, kryterium_id, typ_kryterium
                 FROM arkusz_kryteria
                 WHERE kryterium_id = ANY($1::int[]);`,
                [critIds]
            ),
            db.query(
                `SELECT tk.kryterium_id, COUNT(DISTINCT tk.tag_id)::int AS tag_count
                 FROM tag_kryteria tk
                 JOIN slownik_tagow st ON st.id = tk.tag_id
                 WHERE tk.kryterium_id = ANY($1::int[]) AND st.czy_aktywny = TRUE
                 GROUP BY tk.kryterium_id;`,
                [critIds]
            ),
            db.query(
                `SELECT kryterium_id, COUNT(*)::int AS usage_count
                 FROM ocena_kryteria_wyniki
                 WHERE kryterium_id = ANY($1::int[])
                 GROUP BY kryterium_id;`,
                [critIds]
            ),
        ]);

        for (const row of sheetRes.rows) {
            if (!sheetsByCrit.has(row.kryterium_id)) {
                sheetsByCrit.set(row.kryterium_id, { A: null, B: null, C: null });
            }
            sheetsByCrit.get(row.kryterium_id)[row.kod_arkusza] = row.typ_kryterium;
        }
        for (const row of tagRes.rows) {
            tagCountByCrit.set(row.kryterium_id, Number(row.tag_count || 0));
        }
        for (const row of usageRes.rows) {
            usageCountByCrit.set(row.kryterium_id, Number(row.usage_count || 0));
        }
    }

    return critRes.rows.map((row) => ({
        id: row.id,
        nazwa: row.nazwa,
        opis: row.opis,
        descriptions: row.opis ? row.opis.split('\n').filter(Boolean) : [],
        czy_aktywne: Boolean(row.czy_aktywne),
        sheets: sheetsByCrit.get(row.id) || { A: null, B: null, C: null },
        tagCount: tagCountByCrit.get(row.id) || 0,
        usageCount: usageCountByCrit.get(row.id) || 0,
    }));
}

async function validateCriterionPayload(client, body, { excludeCritId = null } = {}) {
    const { nazwa, opis, sheets } = body || {};

    const trimmedName = String(nazwa || '').trim();
    if (!trimmedName) {
        throw new HttpError(400, 'Nazwa kryterium oceny jest wymagana.');
    }
    if (trimmedName.length > 150) {
        throw new HttpError(400, 'Nazwa kryterium może mieć maksymalnie 150 znaków.');
    }

    const trimmedDesc = String(opis || '').trim();
    if (!trimmedDesc) {
        throw new HttpError(400, 'Opis kryterium (wskaźniki zachowań) jest wymagany.');
    }

    const dupRes = await client.query(
        `SELECT id, czy_aktywne
         FROM slownik_kryteriow
         WHERE LOWER(nazwa) = LOWER($1) AND ($2::int IS NULL OR id <> $2::int)
         LIMIT 1;`,
        [trimmedName, excludeCritId]
    );
    if (dupRes.rows.length > 0) {
        const dup = dupRes.rows[0];
        if (dup.czy_aktywne) {
            throw new HttpError(409, 'Kryterium o tej nazwie już istnieje w słowniku.');
        }
        throw new HttpError(
            409,
            'Istnieje już wycofane kryterium o tej nazwie — przywróć je z archiwum lub zmień jego nazwę.'
        );
    }

    if (!sheets || typeof sheets !== 'object' || Array.isArray(sheets)) {
        throw new HttpError(400, 'Wymagane jest określenie przypisania kryterium do arkuszy (A, B, C).');
    }

    const normalizedSheets = { A: null, B: null, C: null };
    let assignedCount = 0;
    for (const code of SHEET_CODES) {
        const raw = sheets[code];
        if (raw === null || raw === undefined || raw === '' || raw === 'BRAK') {
            normalizedSheets[code] = null;
        } else if (ALLOWED_SHEET_TYPES.has(raw)) {
            normalizedSheets[code] = raw;
            assignedCount++;
        } else {
            throw new HttpError(
                400,
                `Nieprawidłowy typ kryterium dla Arkusza ${code} (dozwolone: OBOWIAZKOWE, DODATKOWE lub brak).`
            );
        }
    }

    if (assignedCount === 0) {
        throw new HttpError(400, 'Kryterium musi być przypisane do co najmniej jednego arkusza (A, B lub C).');
    }

    return {
        nazwa: trimmedName,
        opis: trimmedDesc,
        sheets: normalizedSheets,
    };
}

async function assertSheetsRetainMandatory(client, { critId, nextActive, nextSheets }) {
    for (const code of SHEET_CODES) {
        const otherRes = await client.query(
            `SELECT COUNT(*)::int AS cnt
             FROM arkusz_kryteria ak
             JOIN slownik_kryteriow sk ON sk.id = ak.kryterium_id
             WHERE ak.kod_arkusza = $1
               AND ak.typ_kryterium = 'OBOWIAZKOWE'
               AND sk.czy_aktywne = TRUE
               AND sk.id <> $2;`,
            [code, critId]
        );
        const otherMandatoryCount = Number(otherRes.rows[0].cnt || 0);
        const thisIsActiveMandatory = Boolean(nextActive && nextSheets[code] === 'OBOWIAZKOWE');
        if (otherMandatoryCount === 0 && !thisIsActiveMandatory) {
            throw new HttpError(
                400,
                `Nie można wykonać tej operacji: Arkusz ${code} musi posiadać co najmniej jedno aktywne kryterium obowiązkowe.`
            );
        }
    }
}

router.get(
    '/criteria',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const includeInactive = req.query.includeInactive !== 'false';
        const criteria = await fetchCriteria({ query }, { includeInactive });
        res.json({ criteria });
    })
);

router.post(
    '/criteria',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const criterion = await withTransaction(async (client) => {
            const payload = await validateCriterionPayload(client, req.body);

            const insRes = await client.query(
                `INSERT INTO slownik_kryteriow (nazwa, opis, czy_aktywne)
                 VALUES ($1, $2, TRUE)
                 RETURNING id;`,
                [payload.nazwa, payload.opis]
            );
            const critId = insRes.rows[0].id;

            for (const code of SHEET_CODES) {
                if (payload.sheets[code]) {
                    await client.query(
                        `INSERT INTO arkusz_kryteria (kod_arkusza, kryterium_id, typ_kryterium)
                         VALUES ($1, $2, $3);`,
                        [code, critId, payload.sheets[code]]
                    );
                }
            }

            const rows = await fetchCriteria(client, { id: critId });
            return rows[0];
        });

        res.status(201).json({ criterion });
    })
);

router.put(
    '/criteria/:id',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const critId = Number(req.params.id);
        if (!Number.isInteger(critId) || critId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID kryterium.');
        }

        const criterion = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT * FROM slownik_kryteriow WHERE id = $1;', [critId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Kryterium oceny nie istnieje.');
            }

            const payload = await validateCriterionPayload(client, req.body, { excludeCritId: critId });
            const hasActiveFlag =
                req.body &&
                Object.prototype.hasOwnProperty.call(req.body, 'czy_aktywne') &&
                typeof req.body.czy_aktywne === 'boolean';
            const nextActive = hasActiveFlag ? req.body.czy_aktywne : existingRes.rows[0].czy_aktywne;

            await assertSheetsRetainMandatory(client, {
                critId,
                nextActive,
                nextSheets: payload.sheets,
            });

            await client.query(
                `UPDATE slownik_kryteriow
                 SET nazwa = $1, opis = $2, czy_aktywne = $3
                 WHERE id = $4;`,
                [payload.nazwa, payload.opis, nextActive, critId]
            );

            for (const code of SHEET_CODES) {
                if (!payload.sheets[code]) {
                    await client.query(
                        'DELETE FROM arkusz_kryteria WHERE kod_arkusza = $1 AND kryterium_id = $2;',
                        [code, critId]
                    );
                } else {
                    await client.query(
                        `INSERT INTO arkusz_kryteria (kod_arkusza, kryterium_id, typ_kryterium)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (kod_arkusza, kryterium_id)
                         DO UPDATE SET typ_kryterium = EXCLUDED.typ_kryterium;`,
                        [code, critId, payload.sheets[code]]
                    );
                }
            }

            const rows = await fetchCriteria(client, { id: critId });
            return rows[0];
        });

        res.json({ criterion });
    })
);

router.delete(
    '/criteria/:id',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const critId = Number(req.params.id);
        if (!Number.isInteger(critId) || critId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID kryterium.');
        }

        const criterion = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT id FROM slownik_kryteriow WHERE id = $1;', [critId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Kryterium oceny nie istnieje.');
            }

            await assertSheetsRetainMandatory(client, {
                critId,
                nextActive: false,
                nextSheets: { A: null, B: null, C: null },
            });

            // Non-destructive soft-delete: preserves ocena_kryteria_wyniki, arkusz_kryteria, and tag_kryteria
            await client.query(
                'UPDATE slownik_kryteriow SET czy_aktywne = FALSE WHERE id = $1;',
                [critId]
            );

            const rows = await fetchCriteria(client, { id: critId });
            return rows[0];
        });

        res.json({ archived: true, criterion });
    })
);

router.patch(
    '/criteria/:id/restore',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const critId = Number(req.params.id);
        if (!Number.isInteger(critId) || critId <= 0) {
            throw new HttpError(400, 'Nieprawidłowe ID kryterium.');
        }

        const criterion = await withTransaction(async (client) => {
            const existingRes = await client.query('SELECT id FROM slownik_kryteriow WHERE id = $1;', [critId]);
            if (existingRes.rows.length === 0) {
                throw new HttpError(404, 'Kryterium oceny nie istnieje.');
            }

            await client.query(
                'UPDATE slownik_kryteriow SET czy_aktywne = TRUE WHERE id = $1;',
                [critId]
            );

            const rows = await fetchCriteria(client, { id: critId });
            return rows[0];
        });

        res.json({ restored: true, criterion });
    })
);

module.exports = router;
