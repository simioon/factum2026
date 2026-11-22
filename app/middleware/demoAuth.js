const { query } = require('../db/pool');
const { HttpError } = require('./errorHandler');

const USER_PUBLIC_COLUMNS = `
    id, imie_nazwisko, email, arkusz, rola,
    aktualny_stopien_sluzbowy, nazwa_stanowiska,
    komorka_organizacyjna, przelozony_id, created_at
`;

function formatUser(row) {
    if (!row) return null;
    const stopien = Number(row.aktualny_stopien_sluzbowy || 0);
    return {
        id: row.id,
        imie_nazwisko: row.imie_nazwisko,
        email: row.email,
        arkusz: row.arkusz,
        rola: row.rola,
        aktualny_stopien_sluzbowy: stopien,
        employmentType: stopien > 0 ? 'MIANOWANIE' : 'UMOWA_NIEOKRESLONA',
        rank: stopien > 0 ? stopien : null,
        nazwa_stanowiska: row.nazwa_stanowiska,
        komorka_organizacyjna: row.komorka_organizacyjna,
        przelozony_id: row.przelozony_id,
        created_at: row.created_at,
    };
}

async function attachCurrentUser(req, res, next) {
    try {
        const rawUserId = req.get('X-User-Id');
        if (!rawUserId) {
            req.currentUser = null;
            return next();
        }

        const userId = Number(rawUserId);
        if (!Number.isInteger(userId) || userId <= 0) {
            return next(new HttpError(401, 'Nieprawidłowy nagłówek X-User-Id.'));
        }

        const result = await query(
            `SELECT ${USER_PUBLIC_COLUMNS} FROM uzytkownicy WHERE id = $1;`,
            [userId]
        );
        if (result.rows.length === 0) {
            return next(new HttpError(401, 'Wybrany użytkownik nie istnieje.'));
        }

        req.currentUser = formatUser(result.rows[0]);
        return next();
    } catch (err) {
        return next(err);
    }
}

function requireUser(req, res, next) {
    if (!req.currentUser) {
        return next(new HttpError(401, 'Wymagany wybór aktywnego konta (nagłówek X-User-Id).'));
    }
    return next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.currentUser) {
            return next(new HttpError(401, 'Wymagany wybór aktywnego konta (nagłówek X-User-Id).'));
        }
        if (!roles.includes(req.currentUser.rola)) {
            return next(
                new HttpError(
                    403,
                    `Brak uprawnień do wykonania tej operacji (wymagana rola: ${roles.join(', ')}).`
                )
            );
        }
        return next();
    };
}

module.exports = {
    USER_PUBLIC_COLUMNS,
    formatUser,
    attachCurrentUser,
    requireUser,
    requireRole,
};
