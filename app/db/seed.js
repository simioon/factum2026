const { withTransaction } = require('./pool');

const CRITERIA_SEED = [
    {
        id: 1,
        name: 'Komunikacja',
        descriptions: [
            'Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.',
            'Wypowiadanie się w sposób jasny i precyzyjny, dostosowany do sytuacji i rozmówcy (dobieranie stylu, języka i treści).',
            'Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych dostosowanych do sytuacji i odbiorcy (dobieranie stylu, języka i treści).',
            'Przedstawianie przekonujących argumentów odpowiednio do sytuacji.',
        ],
    },
    {
        id: 2,
        name: 'Kreatywność',
        descriptions: [
            'Proponowanie lub tworzenie nowych rozwiązań.',
            'Nieschematyczne podejście do zadań.',
        ],
    },
    {
        id: 3,
        name: 'Negocjowanie',
        descriptions: [
            'Przygotowywanie się do negocjacji, w szczególności opracowanie projektu stanowiska, zakresu możliwych ustępstw i argumentacji.',
            'Stosowanie technik i strategii negocjacyjnych.',
            'Osiągnięcie efektu negocjacji akceptowanego przez przełożonych.',
        ],
    },
    {
        id: 4,
        name: 'Organizacja pracy i orientacja na osiąganie celów',
        descriptions: [
            'Określanie sposobu realizacji zadań/celów.',
            'Realizowanie zadań/celów w kolejności uwzględniającej ich wagę i pilność (ustalanie priorytetów działania).',
            'Dobieranie niezbędnych zasobów umożliwiających realizację zadań/celów.',
            'Dostosowywanie się do zmieniających się okoliczności.',
            'Wytrwałość i zaangażowanie w realizację zadań/celów.',
        ],
    },
    {
        id: 5,
        name: 'Orientacja na klienta/interesanta',
        descriptions: [
            'Taktowne zachowanie, wyrażające szacunek i zrozumienie dla drugiej osoby.',
            'Reagowanie na potrzeby klienta/interesanta, w szczególności rozpoznawanie jego potrzeb i proponowanie rozwiązań.',
        ],
    },
    {
        id: 6,
        name: 'Podejmowanie decyzji i odpowiedzialność',
        descriptions: [
            'Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności potencjalnego ryzyka.',
            'Podejmowanie decyzji (decyzyjność).',
            'Przyjmowanie odpowiedzialności za efekty podjętych decyzji.',
        ],
    },
    {
        id: 7,
        name: 'Radzenie sobie w sytuacjach kryzysowych',
        descriptions: [
            'Rozpoznawanie sytuacji kryzysowych i informowanie o nich zainteresowanych.',
            'Podejmowanie działań mających na celu rozwiązanie kryzysu.',
            'Wyciąganie wniosków z sytuacji kryzysowych.',
        ],
    },
    {
        id: 8,
        name: 'Rzetelność',
        descriptions: [
            'Wykonywanie zadań zgodnie z obowiązującymi standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów.',
            'Dotrzymywanie zobowiązań (realizacja zadań) w wyznaczonym czasie.',
        ],
    },
    {
        id: 9,
        name: 'Myślenie analityczne',
        descriptions: [
            'Rozróżnianie informacji istotnych i nieistotnych.',
            'Dostrzeganie zależności między informacjami.',
            'Formułowanie wniosków.',
        ],
    },
    {
        id: 10,
        name: 'Wykorzystywanie wiedzy i doskonalenie zawodowe',
        descriptions: [
            'Wykorzystywanie wiedzy przy realizacji zadań na zajmowanym stanowisku pracy.',
            'Doskonalenie wiedzy i umiejętności niezbędnych do wykonywania zadań na zajmowanym stanowisku pracy, w szczególności wyszukiwanie i pozyskiwanie wiedzy, korzystanie z dobrych praktyk i doświadczeń innych.',
            'Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii.',
        ],
    },
    {
        id: 11,
        name: 'Współpraca',
        descriptions: [
            'Włączanie się w działania realizowane razem z innymi osobami, jeśli istnieje taka możliwość.',
            'Dbanie o przepływ informacji.',
            'Dbanie o dobrą atmosferę i otwartość we współpracy.',
            'Dostrzeganie wkładu pracy innych osób.',
            'Branie pod uwagę zdania innych osób.',
            'Dzielenie się wiedzą i doświadczeniem.',
        ],
    },
    {
        id: 12,
        name: 'Wystąpienia publiczne',
        descriptions: [
            'Wykorzystywanie różnych środków przekazu (np. narzędzi multimedialnych) i dbałość o sposób prezentacji (w tym autoprezentacji).',
            'Nawiązywanie i utrzymywanie kontaktu z audytorium.',
            'Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych, elastyczne reagowanie na potrzeby audytorium.',
            'Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami.',
        ],
    },
    {
        id: 13,
        name: 'Zarządzanie ludźmi',
        descriptions: [
            'Przydzielanie zakresu odpowiedzialności, zadań i uprawnień pracownikom (delegowanie zadań).',
            'Monitorowanie realizacji zadań oraz w razie potrzeby podejmowanie działań korygujących lub zapobiegawczych.',
            'Motywowanie pracowników.',
            'Udzielanie pracownikom informacji zwrotnej opartej na ocenie ich zaangażowania i sposobu realizacji zadań.',
            'Rozwiązywanie konfliktów.',
            'Wspieranie pracowników w rozwoju zawodowym, w szczególności identyfikowanie potrzeb rozwojowych, proponowanie działań rozwojowych oraz monitorowanie ich realizacji.',
        ],
    },
    {
        id: 14,
        name: 'Zarządzanie strategiczne',
        descriptions: [
            'Tworzenie wizji oraz wyznaczanie celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia oraz strategie rozwoju.',
            'Formułowanie celów operacyjnych na podstawie celów strategicznych.',
            'Analiza ryzyka planowanych działań o charakterze strategicznym.',
        ],
    },
];

const SHEET_MANDATORY = {
    A: [13, 6, 4, 11, 1, 14],
    B: [13, 6, 4, 11, 1],
    C: [10, 8, 4, 11, 1],
};

const TAGS_SEED = [
    { nazwa: '#JasnyPrzekaz', opis: 'mowa/pismo', kategoria: 'KOMPETENCYJNY', criteriaIds: [1, 12, 5] },
    { nazwa: '#Argumentacja', opis: 'przekonywanie', kategoria: 'KOMPETENCYJNY', criteriaIds: [1, 3, 12] },
    { nazwa: '#TaktIEmpatia', opis: 'szacunek/słuchanie', kategoria: 'KOMPETENCYJNY', criteriaIds: [5, 1, 11] },
    { nazwa: '#PracaZespołowa', opis: 'wsparcie/atmosfera', kategoria: 'KOMPETENCYJNY', criteriaIds: [11, 13] },
    { nazwa: '#TerminowośćIPriorytety', opis: 'czas/pilność', kategoria: 'KOMPETENCYJNY', criteriaIds: [4, 8, 12] },
    { nazwa: '#JakośćIProcedury', opis: 'zgodność z prawem', kategoria: 'KOMPETENCYJNY', criteriaIds: [8, 10] },
    { nazwa: '#ElastycznośćIStres', opis: 'presja/kryzys', kategoria: 'KOMPETENCYJNY', criteriaIds: [4, 7, 12] },
    { nazwa: '#InicjatywaIInnowacja', opis: 'nowe pomysły', kategoria: 'KOMPETENCYJNY', criteriaIds: [2, 5, 10] },
    { nazwa: '#AnalizaIRyzyko', opis: 'wnioski/ryzyko', kategoria: 'KOMPETENCYJNY', criteriaIds: [9, 6, 14] },
    { nazwa: '#Decyzyjność', opis: 'odpowiedzialność', kategoria: 'KOMPETENCYJNY', criteriaIds: [6, 7] },
    { nazwa: '#RozwójIWiedza', opis: 'szkolenia/technologia', kategoria: 'KOMPETENCYJNY', criteriaIds: [10, 11] },
    { nazwa: '#DelegowanieIMonitoring', opis: 'podział zadań', kategoria: 'KOMPETENCYJNY', criteriaIds: [13, 4] },
    { nazwa: '#MotywowanieIFeedback', opis: 'rozwój zespołu', kategoria: 'KOMPETENCYJNY', criteriaIds: [13] },
    { nazwa: '#WizjaIStrategia', opis: 'cele strategiczne', kategoria: 'KOMPETENCYJNY', criteriaIds: [14, 3] },
    { nazwa: '#Przeciążenie', opis: 'Dobrostan / HR Partner', kategoria: 'DOBROSTAN', criteriaIds: [] },
    { nazwa: '#Nadgodziny', opis: 'Dobrostan / HR Partner', kategoria: 'DOBROSTAN', criteriaIds: [] },
];

async function insertCriteriaRows(client, ocenaId, scoresByCriterion) {
    for (const [critIdStr, punkty] of Object.entries(scoresByCriterion)) {
        await client.query(
            `INSERT INTO ocena_kryteria_wyniki (ocena_id, kryterium_id, punkty)
             VALUES ($1, $2, $3);`,
            [ocenaId, Number(critIdStr), punkty]
        );
    }
}

async function insertTaskWithTags(client, { ocenaId, autorId, tytul, opis, dataZdarzenia, tags }, tagIdByName) {
    const taskRes = await client.query(
        `INSERT INTO zadania_obserwacje (ocena_id, autor_id, tytul, opis, data_zdarzenia, widocznosc)
         VALUES ($1, $2, $3, $4, $5, 'OBIE_STRONY')
         RETURNING id;`,
        [ocenaId, autorId, tytul, opis, dataZdarzenia]
    );
    const taskId = taskRes.rows[0].id;
    for (const tg of tags) {
        await client.query(
            `INSERT INTO zadanie_tagi (zadanie_id, tag_id, polaryzacja, komentarz)
             VALUES ($1, $2, $3, $4);`,
            [taskId, tagIdByName[tg.tagName], tg.polarity, tg.comment]
        );
    }
}

async function seedDictionaries(client) {
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM slownik_kryteriow;');
    if (rows[0].cnt > 0) return;

    for (const c of CRITERIA_SEED) {
        await client.query(
            `INSERT INTO slownik_kryteriow (id, nazwa, opis, czy_aktywne)
             VALUES ($1, $2, $3, TRUE);`,
            [c.id, c.name, c.descriptions.join('\n')]
        );
    }

    await client.query(
        `SELECT setval(pg_get_serial_sequence('slownik_kryteriow', 'id'), (SELECT MAX(id) FROM slownik_kryteriow));`
    );

    for (const sheet of ['A', 'B', 'C']) {
        const mandatorySet = new Set(SHEET_MANDATORY[sheet]);
        for (const c of CRITERIA_SEED) {
            const typ = mandatorySet.has(c.id) ? 'OBOWIAZKOWE' : 'DODATKOWE';
            await client.query(
                `INSERT INTO arkusz_kryteria (kod_arkusza, kryterium_id, typ_kryterium)
                 VALUES ($1, $2, $3);`,
                [sheet, c.id, typ]
            );
        }
    }

    for (const t of TAGS_SEED) {
        const tagRes = await client.query(
            `INSERT INTO slownik_tagow (nazwa, kategoria, opis, czy_aktywny)
             VALUES ($1, $2, $3, TRUE)
             RETURNING id;`,
            [t.nazwa, t.kategoria, t.opis]
        );
        const tagId = tagRes.rows[0].id;
        for (const critId of t.criteriaIds) {
            await client.query(
                `INSERT INTO tag_kryteria (tag_id, kryterium_id)
                 VALUES ($1, $2);`,
                [tagId, critId]
            );
        }
    }

    console.log('Seeded 14 criteria, 42 sheet mappings, and 16 tags.');
}

async function seedDemoData(client) {
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM uzytkownicy;');
    if (rows[0].cnt > 0) return;

    const demoHash = 'DEMO_NO_PASSWORD_AUTH';

    // 1. Marek Wiśniewski (Dyrektor Generalny)
    const marek = (
        await client.query(
            `INSERT INTO uzytkownicy (
                imie_nazwisko, email, arkusz, rola, haslo_hash, aktualny_stopien_sluzbowy,
                nazwa_stanowiska, komorka_organizacyjna, przelozony_id
            ) VALUES ($1, $2, 'A', 'DYREKTOR', $3, 7, $4, $5, NULL) RETURNING id;`,
            [
                'Marek Wiśniewski',
                'marek.wisniewski@urzad.gov.pl',
                demoHash,
                'Dyrektor Generalny Urzędu',
                'Kierownictwo Urzędu',
            ]
        )
    ).rows[0].id;

    // 2. Jan Kowalski (Oceniający / Naczelnik)
    const jan = (
        await client.query(
            `INSERT INTO uzytkownicy (
                imie_nazwisko, email, arkusz, rola, haslo_hash, aktualny_stopien_sluzbowy,
                nazwa_stanowiska, komorka_organizacyjna, przelozony_id
            ) VALUES ($1, $2, 'B', 'OCENIAJACY', $3, 4, $4, $5, $6) RETURNING id;`,
            [
                'Jan Kowalski',
                'jan.kowalski@urzad.gov.pl',
                demoHash,
                'Naczelnik Wydziału Analiz',
                'Wydział Analiz i Sprawozdawczości',
                marek,
            ]
        )
    ).rows[0].id;

    // 3. Piotr Zieliński (Admin)
    const piotr = (
        await client.query(
            `INSERT INTO uzytkownicy (
                imie_nazwisko, email, arkusz, rola, haslo_hash, aktualny_stopien_sluzbowy,
                nazwa_stanowiska, komorka_organizacyjna, przelozony_id
            ) VALUES ($1, $2, 'C', 'ADMIN', $3, 0, $4, $5, $6) RETURNING id;`,
            [
                'Piotr Zieliński',
                'piotr.zielinski@urzad.gov.pl',
                demoHash,
                'Administrator Systemu IT',
                'Biuro Informatyki',
                marek,
            ]
        )
    ).rows[0].id;

    // 4. Anna Nowak (Oceniany, mianowana stopień II)
    const anna = (
        await client.query(
            `INSERT INTO uzytkownicy (
                imie_nazwisko, email, arkusz, rola, haslo_hash, aktualny_stopien_sluzbowy,
                nazwa_stanowiska, komorka_organizacyjna, przelozony_id
            ) VALUES ($1, $2, 'C', 'OCENIANY', $3, 2, $4, $5, $6) RETURNING id;`,
            [
                'Anna Nowak',
                'anna.nowak@urzad.gov.pl',
                demoHash,
                'Starszy Specjalista ds. Analiz',
                'Wydział Analiz i Sprawozdawczości',
                jan,
            ]
        )
    ).rows[0].id;

    // 5. Tomasz Mazur (Oceniany, umowa na czas nieokreślony)
    const tomasz = (
        await client.query(
            `INSERT INTO uzytkownicy (
                imie_nazwisko, email, arkusz, rola, haslo_hash, aktualny_stopien_sluzbowy,
                nazwa_stanowiska, komorka_organizacyjna, przelozony_id
            ) VALUES ($1, $2, 'C', 'OCENIANY', $3, 0, $4, $5, $6) RETURNING id;`,
            [
                'Tomasz Mazur',
                'tomasz.mazur@urzad.gov.pl',
                demoHash,
                'Specjalista ds. Kontroli',
                'Wydział Analiz i Sprawozdawczości',
                jan,
            ]
        )
    ).rows[0].id;

    // Historical evaluation 1: Anna Nowak (2024-11-28, POZYTYWNA 7.40)
    const ev1 = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, data_rozmowy_wstepnej,
                planowana_data_oceny, data_rozmowy_oceniajacej, data_zapoznania_z_ocena,
                srednia_punktow, poziom_oceny, wynik_ogolny, uzasadnienie_oceny, wnioski_iprz,
                podpis_kryteria_oceniajacy_at, podpis_kryteria_oceniany_at,
                podpis_ocena_oceniajacy_at, podpis_ocena_oceniany_at
            ) VALUES (
                $1, $2, 'C', 'ZAKONCZONA',
                '2022-11-28', '2022-12-28', '2022-12-10',
                '2024-11-28', '2024-11-28', '2024-11-28',
                7.40, 'POWYZEJ_OCZEKIWAN', 'POZYTYWNA',
                'Bardzo wysoka jakość analiz i wzorowa współpraca w zespole.',
                'Udział w szkoleniu z zaawansowanej analizy danych i wizualizacji.',
                '2022-12-10 10:00:00', '2022-12-10 10:05:00',
                '2024-11-28 14:22:00', '2024-11-28 14:22:00'
            ) RETURNING id;`,
            [anna, jan]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, ev1, { 10: 7, 8: 7, 4: 7, 11: 9, 1: 7 });

    // Historical evaluation 2: Tomasz Mazur (2026-11-14, NEGATYWNA 3.40)
    const ev2 = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, data_rozmowy_wstepnej,
                planowana_data_oceny, data_rozmowy_oceniajacej, data_zapoznania_z_ocena,
                srednia_punktow, poziom_oceny, wynik_ogolny, uzasadnienie_oceny, wnioski_iprz,
                podpis_kryteria_oceniajacy_at, podpis_kryteria_oceniany_at,
                podpis_ocena_oceniajacy_at, podpis_ocena_oceniany_at
            ) VALUES (
                $1, $2, 'C', 'ZAKONCZONA',
                '2024-11-14', '2024-12-14', '2024-11-25',
                '2026-11-14', '2026-11-14', '2026-11-14',
                3.40, 'PONIZEJ_OCZEKIWAN', 'NEGATYWNA',
                'Powtarzające się opóźnienia w realizacji protokołów kontrolnych oraz braki formalne.',
                'Szkolenie z zarządzania czasem oraz mentoring starszego specjalisty.',
                '2024-11-25 09:00:00', '2024-11-25 09:10:00',
                '2026-11-14 11:05:00', '2026-11-14 11:05:00'
            ) RETURNING id;`,
            [tomasz, jan]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, ev2, { 10: 5, 8: 3, 4: 3, 11: 3, 1: 3 });

    // Historical evaluation 3: Jan Kowalski (2024-12-20, POZYTYWNA 7.40)
    const ev3 = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, data_rozmowy_wstepnej,
                planowana_data_oceny, data_rozmowy_oceniajacej, data_zapoznania_z_ocena,
                srednia_punktow, poziom_oceny, wynik_ogolny, uzasadnienie_oceny, wnioski_iprz,
                podpis_kryteria_oceniajacy_at, podpis_kryteria_oceniany_at,
                podpis_ocena_oceniajacy_at, podpis_ocena_oceniany_at
            ) VALUES (
                $1, $2, 'B', 'ZAKONCZONA',
                '2022-12-20', '2023-01-19', '2023-01-05',
                '2024-12-20', '2024-12-20', '2024-12-20',
                7.40, 'POWYZEJ_OCZEKIWAN', 'POZYTYWNA',
                'Skuteczne kierowanie wydziałem i wysoka decyzyjność.',
                'Warsztaty z zarządzania zmianą w administracji publicznej.',
                '2023-01-05 11:00:00', '2023-01-05 11:05:00',
                '2024-12-20 09:40:00', '2024-12-20 09:40:00'
            ) RETURNING id;`,
            [jan, marek]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, ev3, { 13: 7, 6: 7, 4: 7, 11: 9, 1: 7 });

    // Pending rank request rr1 for Jan Kowalski (stopień V)
    await client.query(
        `INSERT INTO wnioski_stopien_sluzbowy (
            ocena_id, tryb_przyznania, wnioskowany_stopien, umotywowanie_przelozonego, status_decyzji
        ) VALUES ($1, 'FAKULTATYWNY', 5, $2, 'OCZEKUJE');`,
        [ev3, 'Wzorowe wyniki wydziału w okresie sprawozdawczym i wdrożenie nowych standardów.']
    );

    // Active Cycle 1: Anna Nowak (W_TRAKCIE_OKRESU, mandatory + [9, 5])
    const annaActive = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, data_rozmowy_wstepnej,
                planowana_data_oceny, oczekiwania_i_cele,
                podpis_kryteria_oceniajacy_at, podpis_kryteria_oceniany_at
            ) VALUES (
                $1, $2, 'C', 'W_TRAKCIE_OKRESU',
                '2024-12-01', '2024-12-31', '2024-12-18',
                '2026-12-01', $3,
                '2024-12-18 10:15:00', '2024-12-18 10:15:00'
            ) RETURNING id;`,
            [
                anna,
                jan,
                'Omówiono przygotowywanie raportów kwartalnych oraz rozwój kompetencji analitycznych i obsługi interesanta.',
            ]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, annaActive, { 10: null, 8: null, 4: null, 11: null, 1: null, 9: null, 5: null });

    // Active Cycle 2: Tomasz Mazur (WYZNACZANIE_KRYTERIOW, +7d / +6m after negative, mandatory + [7])
    const tomaszActive = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow,
                planowana_data_oceny
            ) VALUES (
                $1, $2, 'C', 'WYZNACZANIE_KRYTERIOW',
                '2026-11-16', '2026-11-23', '2027-05-16'
            ) RETURNING id;`,
            [tomasz, jan]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, tomaszActive, { 10: null, 8: null, 4: null, 11: null, 1: null, 7: null });

    // Active Cycle 3: Jan Kowalski (W_TRAKCIE_OKRESU, mandatory + [9])
    const janActive = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow, data_rozmowy_wstepnej,
                planowana_data_oceny, oczekiwania_i_cele,
                podpis_kryteria_oceniajacy_at, podpis_kryteria_oceniany_at
            ) VALUES (
                $1, $2, 'B', 'W_TRAKCIE_OKRESU',
                '2025-01-10', '2025-02-09', '2025-01-25',
                '2027-01-10', $3,
                '2025-01-25 13:00:00', '2025-01-25 13:00:00'
            ) RETURNING id;`,
            [jan, marek, 'Priorytet: sprawne delegowanie zadań w powiększonym zespole i regularny feedback.']
        )
    ).rows[0].id;
    await insertCriteriaRows(client, janActive, { 13: null, 6: null, 4: null, 11: null, 1: null, 9: null });

    // Active Cycle 4: Piotr Zieliński (WYZNACZANIE_KRYTERIOW)
    const piotrActive = (
        await client.query(
            `INSERT INTO oceny_okresowe (
                pracownik_id, oceniajacy_id, typ_arkusza, status,
                data_rozpoczecia_cyklu, termin_wyznaczenia_kryteriow,
                planowana_data_oceny
            ) VALUES (
                $1, $2, 'C', 'WYZNACZANIE_KRYTERIOW',
                '2025-03-01', '2025-03-31', '2027-03-01'
            ) RETURNING id;`,
            [piotr, marek]
        )
    ).rows[0].id;
    await insertCriteriaRows(client, piotrActive, { 10: null, 8: null, 4: null, 11: null, 1: null });

    // Lookup tag IDs
    const tagRows = (await client.query('SELECT id, nazwa FROM slownik_tagow;')).rows;
    const tagIdByName = Object.fromEntries(tagRows.map((r) => [r.nazwa, r.id]));

    // Seed 6 tasks + 17 tags
    await insertTaskWithTags(
        client,
        {
            ocenaId: annaActive,
            autorId: jan,
            tytul: 'Przygotowanie kwartalnego raportu budżetowego',
            opis: 'Zebranie danych z 4 wydziałów i opracowanie zestawienia dla Ministerstwa.',
            dataZdarzenia: '2025-09-14',
            tags: [
                { tagName: '#JakośćIProcedury', polarity: '+', comment: 'Zero błędów formalnych, wzorowa zgodność z wytycznymi.' },
                { tagName: '#AnalizaIRyzyko', polarity: '+', comment: 'Szybko wychwyciła rozbieżność w kosztach terenowych.' },
                { tagName: '#TerminowośćIPriorytety', polarity: '+', comment: 'Raport oddany 2 dni przed terminem.' },
            ],
        },
        tagIdByName
    );

    await insertTaskWithTags(
        client,
        {
            ocenaId: annaActive,
            autorId: jan,
            tytul: 'Obsługa trudnego zapytania w trybie informacji publicznej',
            opis: 'Odpowiedź pisemna i konsultacja telefoniczna z interesantem.',
            dataZdarzenia: '2026-03-20',
            tags: [
                { tagName: '#JasnyPrzekaz', polarity: '+', comment: 'Bardzo przejrzyste i zrozumiałe pismo urzędowe.' },
                { tagName: '#TaktIEmpatia', polarity: '+', comment: 'Spokojna, kulturalna rozmowa mimo dużych emocji interesanta.' },
            ],
        },
        tagIdByName
    );

    await insertTaskWithTags(
        client,
        {
            ocenaId: annaActive,
            autorId: jan,
            tytul: 'Wdrożenie nowego pracownika w system EZD',
            opis: 'Przekazanie wiedzy i opieka merytoryczna w pierwszym miesiącu.',
            dataZdarzenia: '2026-08-05',
            tags: [
                { tagName: '#PracaZespołowa', polarity: '+', comment: 'Chętnie pomagała i dbała o świetną atmosferę.' },
                { tagName: '#RozwójIWiedza', polarity: '+', comment: 'Opracowała krótką instrukcję PDF dla całego wydziału.' },
                { tagName: '#TerminowośćIPriorytety', polarity: '-', comment: 'Przez dodatkowe wsparcie opóźniła własną notatkę służbową o 1 dzień.' },
            ],
        },
        tagIdByName
    );

    await insertTaskWithTags(
        client,
        {
            ocenaId: tomaszActive,
            autorId: jan,
            tytul: 'Kontrola dokumentacji projektowej (zastępstwo za kolegę na L4)',
            opis: 'Przejęcie pilnych teczek w trakcie wzmożonego okresu sprawozdawczego.',
            dataZdarzenia: '2026-09-18',
            tags: [
                { tagName: '#TerminowośćIPriorytety', polarity: '-', comment: 'Przekroczony termin oddania 2 protokołów kontrolnych.' },
                { tagName: '#ElastycznośćIStres', polarity: '-', comment: 'Widoczne duże zmęczenie i trudność z presją czasu.' },
                { tagName: '#Przeciążenie', polarity: '-', comment: 'Przejął pełen zakres obowiązków za nieobecnego współpracownika.' },
            ],
        },
        tagIdByName
    );

    await insertTaskWithTags(
        client,
        {
            ocenaId: tomaszActive,
            autorId: jan,
            tytul: 'Odpowiedź na wystąpienie pokontrolne',
            opis: 'Przygotowanie korekty załączników i uzgodnień prawnych.',
            dataZdarzenia: '2026-10-22',
            tags: [
                { tagName: '#JakośćIProcedury', polarity: '-', comment: 'Drobne pomyłki w numeracji załączników wymagające poprawy.' },
                { tagName: '#Nadgodziny', polarity: '-', comment: 'Zostawał po godzinach 3 razy w tym samym tygodniu.' },
                { tagName: '#PracaZespołowa', polarity: '+', comment: 'Mimo zmęczenia bez problemu przekazał komplet akt koleżance.' },
            ],
        },
        tagIdByName
    );

    await insertTaskWithTags(
        client,
        {
            ocenaId: janActive,
            autorId: marek,
            tytul: 'Reorganizacja pracy w Wydziale Analiz',
            opis: 'Nowy podział obowiązków i wdrożenie cotygodniowych spotkań statusowych.',
            dataZdarzenia: '2026-06-10',
            tags: [
                { tagName: '#DelegowanieIMonitoring', polarity: '+', comment: 'Jasny podział odpowiedzialności w zespole.' },
                { tagName: '#MotywowanieIFeedback', polarity: '+', comment: 'Regularne rozmowy wspierające z pracownikami.' },
                { tagName: '#Decyzyjność', polarity: '+', comment: 'Sprawne podjęcie decyzji o przesunięciu zasobów.' },
            ],
        },
        tagIdByName
    );

    console.log('Seeded 5 demo users, evaluations, active cycles, 6 tasks, 17 tags, and 1 rank request.');
}

async function seedIfEmpty() {
    await withTransaction(async (client) => {
        await seedDictionaries(client);
        await seedDemoData(client);
    });
}

module.exports = {
    seedIfEmpty,
};
