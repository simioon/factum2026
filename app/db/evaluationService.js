const {
    LEGAL_CONFIG,
    LEVEL_LABELS,
    STATUS_LABELS,
    addDaysIso,
    addMonthsIso,
    todayIso,
} = require('../domain/legalRules');
const { HttpError } = require('../middleware/errorHandler');

const ACTIVE_STATUSES = [
    'WYZNACZANIE_KRYTERIOW',
    'OCZEKIWANIE_NA_PODPIS_KRYTERIOW',
    'W_TRAKCIE_OKRESU',
    'PRZED_ROZMOWA_OCENIAJACA',
    'SPORZADZONA_DO_PODPISU',
];

const EDITABLE_SETUP_STATUSES = [
    'WYZNACZANIE_KRYTERIOW',
    'OCZEKIWANIE_NA_PODPIS_KRYTERIOW',
    'W_TRAKCIE_OKRESU',
    'PRZED_ROZMOWA_OCENIAJACA',
];

const ACTIVE_EVAL_ORDER_SQL = `
    CASE status
        WHEN 'PRZED_ROZMOWA_OCENIAJACA' THEN 0
        WHEN 'SPORZADZONA_DO_PODPISU' THEN 1
        ELSE 2
    END ASC,
    id DESC
`;

async function createActiveCycle(
    client,
    {
        pracownikId,
        oceniajacyId,
        typArkusza,
        startDate = todayIso(),
        isAfterNegative = false,
        numerPodejscia = 1,
        poprzedniaOcenaId = null,
        status = 'WYZNACZANIE_KRYTERIOW',
        criteriaIdsOverride = null,
    }
) {
    const interviewDays = isAfterNegative
        ? LEGAL_CONFIG.initialInterviewDaysAfterNegative
        : LEGAL_CONFIG.initialInterviewDaysNormal;
    const cycleMonths = isAfterNegative
        ? LEGAL_CONFIG.cycleMonthsAfterNegative
        : LEGAL_CONFIG.cycleMonths;

    const terminKryteriow = addDaysIso(startDate, interviewDays);
    const planowanaDataOceny = addMonthsIso(startDate, cycleMonths);

    const insertRes = await client.query(
        `INSERT INTO oceny_okresowe (
            pracownik_id, oceniajacy_id, typ_arkusza,
            numer_podejscia, poprzednia_ocena_id, status,
            data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, planowana_data_oceny
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;`,
        [
            pracownikId,
            oceniajacyId,
            typArkusza,
            numerPodejscia,
            poprzedniaOcenaId,
            status,
            startDate,
            terminKryteriow,
            planowanaDataOceny,
        ]
    );
    const evalRow = insertRes.rows[0];

    let criteriaIds = criteriaIdsOverride;
    if (!Array.isArray(criteriaIds) || criteriaIds.length === 0) {
        const mandRes = await client.query(
            `SELECT kryterium_id
             FROM arkusz_kryteria
             WHERE kod_arkusza = $1 AND typ_kryterium = 'OBOWIAZKOWE'
             ORDER BY id ASC;`,
            [typArkusza]
        );
        criteriaIds = mandRes.rows.map((r) => r.kryterium_id);
    }

    for (const critId of criteriaIds) {
        await client.query(
            `INSERT INTO ocena_kryteria_wyniki (ocena_id, kryterium_id, punkty)
             VALUES ($1, $2, NULL)
             ON CONFLICT (ocena_id, kryterium_id) DO NOTHING;`,
            [evalRow.id, critId]
        );
    }

    return evalRow;
}

async function hydrateEvaluation(db, evalRow, { includePrivateTasks = true } = {}) {
    if (!evalRow) return null;

    const criteriaRes = await db.query(
        `SELECT
            okw.id,
            okw.ocena_id,
            okw.kryterium_id,
            okw.punkty,
            okw.komentarz_czastkowy,
            sk.nazwa,
            sk.opis,
            COALESCE(ak.typ_kryterium, 'DODATKOWE') AS typ_kryterium
         FROM ocena_kryteria_wyniki okw
         JOIN slownik_kryteriow sk ON sk.id = okw.kryterium_id
         LEFT JOIN arkusz_kryteria ak
           ON ak.kryterium_id = okw.kryterium_id AND ak.kod_arkusza = $2
         WHERE okw.ocena_id = $1
         ORDER BY
            CASE WHEN ak.typ_kryterium = 'OBOWIAZKOWE' THEN 0 ELSE 1 END ASC,
            COALESCE(ak.id, okw.kryterium_id) ASC;`,
        [evalRow.id, evalRow.typ_arkusza]
    );

    const visibilityClause = includePrivateTasks ? '' : "AND zo.widocznosc = 'OBIE_STRONY'";
    const tasksRes = await db.query(
        `SELECT
            zo.id,
            zo.ocena_id,
            zo.autor_id,
            u.imie_nazwisko AS autor_nazwa,
            zo.tytul,
            zo.opis,
            zo.data_zdarzenia,
            zo.widocznosc,
            zo.created_at
         FROM zadania_obserwacje zo
         LEFT JOIN uzytkownicy u ON u.id = zo.autor_id
         WHERE zo.ocena_id = $1 ${visibilityClause}
         ORDER BY zo.data_zdarzenia DESC, zo.id DESC;`,
        [evalRow.id]
    );

    const taskIds = tasksRes.rows.map((t) => t.id);
    const tagsByTaskId = new Map();
    if (taskIds.length > 0) {
        const taskTagsRes = await db.query(
            `SELECT
                zt.id,
                zt.zadanie_id,
                zt.tag_id,
                zt.polaryzacja,
                zt.komentarz,
                st.nazwa AS tag_nazwa,
                st.kategoria,
                st.opis AS tag_opis,
                COALESCE(
                    ARRAY_AGG(tk.kryterium_id ORDER BY tk.kryterium_id)
                        FILTER (WHERE tk.kryterium_id IS NOT NULL),
                    '{}'
                ) AS kryteria_ids
             FROM zadanie_tagi zt
             JOIN slownik_tagow st ON st.id = zt.tag_id
             LEFT JOIN tag_kryteria tk ON tk.tag_id = st.id
             WHERE zt.zadanie_id = ANY($1::int[])
             GROUP BY zt.id, st.id
             ORDER BY zt.id ASC;`,
            [taskIds]
        );
        for (const row of taskTagsRes.rows) {
            if (!tagsByTaskId.has(row.zadanie_id)) {
                tagsByTaskId.set(row.zadanie_id, []);
            }
            tagsByTaskId.get(row.zadanie_id).push(row);
        }
    }

    const tasks = tasksRes.rows.map((t) => ({
        ...t,
        tags: tagsByTaskId.get(t.id) || [],
    }));

    const hrEventsRes = await db.query(
        `SELECT *
         FROM zdarzenia_kadrowe
         WHERE ocena_id = $1
         ORDER BY data_od DESC, id DESC;`,
        [evalRow.id]
    );

    const appealsRes = await db.query(
        `SELECT *
         FROM sprzeciwy_odwolania
         WHERE ocena_id = $1
         ORDER BY id DESC;`,
        [evalRow.id]
    );

    const rankReqRes = await db.query(
        `SELECT *
         FROM wnioski_stopien_sluzbowy
         WHERE ocena_id = $1
         ORDER BY id DESC;`,
        [evalRow.id]
    );

    const criteria = criteriaRes.rows.map((c) => ({
        ...c,
        descriptions: c.opis ? c.opis.split('\n').filter(Boolean) : [],
    }));

    return {
        ...evalRow,
        status_label: STATUS_LABELS[evalRow.status] || evalRow.status,
        poziom_oceny_label: evalRow.poziom_oceny ? LEVEL_LABELS[evalRow.poziom_oceny] || evalRow.poziom_oceny : null,
        criteria,
        tasks,
        hrEvents: hrEventsRes.rows,
        appeals: appealsRes.rows,
        rankRequests: rankReqRes.rows,
    };
}

function assertCanViewEvaluation(currentUser, evalRow) {
    if (!currentUser) {
        throw new HttpError(401, 'Wymagany wybór aktywnego konta.');
    }
    const allowed =
        currentUser.id === evalRow.pracownik_id ||
        currentUser.id === evalRow.oceniajacy_id ||
        currentUser.rola === 'DYREKTOR' ||
        currentUser.rola === 'ADMIN';
    if (!allowed) {
        throw new HttpError(403, 'Brak uprawnień do podglądu tej oceny okresowej.');
    }
}

function assertCanEvaluate(currentUser, evalRow) {
    if (!currentUser) {
        throw new HttpError(401, 'Wymagany wybór aktywnego konta.');
    }
    const allowed =
        currentUser.id === evalRow.oceniajacy_id ||
        currentUser.rola === 'DYREKTOR' ||
        currentUser.rola === 'ADMIN';
    if (!allowed || currentUser.rola === 'OCENIANY') {
        throw new HttpError(403, 'Tylko przypisany oceniający lub Dyrektor może wykonać tę operację.');
    }
}

module.exports = {
    ACTIVE_STATUSES,
    EDITABLE_SETUP_STATUSES,
    ACTIVE_EVAL_ORDER_SQL,
    createActiveCycle,
    hydrateEvaluation,
    assertCanViewEvaluation,
    assertCanEvaluate,
};
