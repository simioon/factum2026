const MOCK_STORAGE_KEY = 'cyfrowy_asystent_mock_db_v1';

const LEGAL_CONFIG = {
    cycleMonths: 24,
    cycleMonthsAfterNegative: 6,
    initialInterviewDaysNormal: 30,
    initialInterviewDaysAfterNegative: 7,
    maxAdditionalCriteria: 3,
    appealDaysLimit: 7,
    appealReviewDaysLimit: 14,
};

const SCORE_SCALE = [
    { value: 1, label: '1 pkt — Znacznie poniżej oczekiwań' },
    { value: 3, label: '3 pkt — Poniżej oczekiwań' },
    { value: 5, label: '5 pkt — Na poziomie oczekiwań' },
    { value: 7, label: '7 pkt — Powyżej oczekiwań' },
    { value: 9, label: '9 pkt — Znacznie powyżej oczekiwań' },
];

const LEVEL_LABELS = {
    ZNACZNIE_PONIZEJ_OCZEKIWAN: 'Znacznie poniżej oczekiwań',
    PONIZEJ_OCZEKIWAN: 'Poniżej oczekiwań',
    NA_POZIOMIE_OCZEKIWAN: 'Na poziomie oczekiwań',
    POWYZEJ_OCZEKIWAN: 'Powyżej oczekiwań',
    ZNACZNIE_POWYZEJ_OCZEKIWAN: 'Znacznie powyżej oczekiwań',
};

const STATUS_LABELS = {
    WYZNACZANIE_KRYTERIOW: 'Wyznaczanie kryteriów',
    OCZEKIWANIE_NA_PODPIS_KRYTERIOW: 'Oczekuje na e-podpis kryteriów (Oceniany)',
    W_TRAKCIE_OKRESU: 'W trakcie okresu oceny',
    PRZED_ROZMOWA_OCENIAJACA: 'Przed rozmową oceniającą',
    SPORZADZONA_DO_PODPISU: 'Sporządzona — oczekuje na zapoznanie (e-podpis)',
    ZAKONCZONA: 'Zakończona',
    ODWOLANIE_W_TOKU: 'Odwołanie (sprzeciw) w toku',
    UNIEWAZNIONA: 'Unieważniona (ponowna ocena)',
};

const APPEAL_DECISION_LABELS = {
    OCZEKUJE: 'Oczekuje na decyzję Dyrektora',
    ODRZUCONY: 'Odrzucony',
    UWZGLEDNIONY_ZMIANA: 'Uwzględniony — zmiana oceny',
    UWZGLEDNIONY_PONOWNA_OCENA: 'Uwzględniony — ponowna ocena',
    NIEROZPATRZONY_W_TERMINIE: 'Nierozpatrzony w terminie (ponowna ocena)',
};

const RANK_STATUS_LABELS = {
    OCZEKUJE: 'Oczekuje na decyzję Dyrektora',
    ZATWIERDZONY: 'Zatwierdzony',
    ODRZUCONY: 'Odrzucony',
};

const EVENT_TYPE_LABELS = {
    NIEOBECNOSC_POWYZEJ_MIESIACA: 'Nieobecność powyżej miesiąca',
    ZMIANA_STANOWISKA: 'Zmiana stanowiska',
    ZMIANA_OCENIAJACEGO: 'Zmiana oceniającego',
    INNE: 'Inne zdarzenie kadrowe',
};

const IPRZ_SUGGESTIONS_BY_CRITERION = {
    1: 'Szkolenie z prostego języka w pismach urzędowych i skutecznej komunikacji.',
    2: 'Warsztaty z myślenia projektowego (Design Thinking) w administracji publicznej.',
    3: 'Szkolenie praktyczne z technik negocjacji i budowania argumentacji.',
    4: 'Warsztaty z zarządzania czasem, ustalania priorytetów i organizacji pracy własnej.',
    5: 'Szkolenie z profesjonalnej obsługi interesanta i radzenia sobie z trudnym klientem.',
    6: 'Kurs z oceny ryzyka oraz podejmowania decyzji w warunkach niepewności.',
    7: 'Warsztaty z zarządzania stresem oraz działania w sytuacjach kryzysowych.',
    8: 'Szkolenie aktualizujące z procedur KPA i standardów kontroli jakości dokumentów.',
    9: 'Kurs zaawansowanej analizy danych i wyciągania wniosków (Excel / BI).',
    10: 'Udział w szkoleniach specjalistycznych i wymianie dobrych praktyk (KSAP).',
    11: 'Warsztaty ze współpracy zespołowej i sprawnego przepływu informacji.',
    12: 'Trening wystąpień publicznych oraz autoprezentacji.',
    13: 'Akademia Lidera SC: delegowanie zadań, motywowanie i udzielanie feedbacku.',
    14: 'Studia podyplomowe / warsztaty z zarządzania strategicznego w sektorze publicznym.',
};

const CRITERIA_CATALOG = [
    {
        id: 1,
        nazwa: 'Komunikacja',
        descriptions: [
            'Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.',
            'Wypowiadanie się w sposób jasny i precyzyjny, dostosowany do sytuacji i rozmówcy (dobieranie stylu, języka i treści).',
            'Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych dostosowanych do sytuacji i odbiorcy (dobieranie stylu, języka i treści).',
            'Przedstawianie przekonujących argumentów odpowiednio do sytuacji.',
        ],
    },
    {
        id: 2,
        nazwa: 'Kreatywność',
        descriptions: [
            'Proponowanie lub tworzenie nowych rozwiązań.',
            'Nieschematyczne podejście do zadań.',
        ],
    },
    {
        id: 3,
        nazwa: 'Negocjowanie',
        descriptions: [
            'Przygotowywanie się do negocjacji, w szczególności opracowanie projektu stanowiska, zakresu możliwych ustępstw i argumentacji.',
            'Stosowanie technik i strategii negocjacyjnych.',
            'Osiągnięcie efektu negocjacji akceptowanego przez przełożonych.',
        ],
    },
    {
        id: 4,
        nazwa: 'Organizacja pracy i orientacja na osiąganie celów',
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
        nazwa: 'Orientacja na klienta/interesanta',
        descriptions: [
            'Taktowne zachowanie, wyrażające szacunek i zrozumienie dla drugiej osoby.',
            'Reagowanie na potrzeby klienta/interesanta, w szczególności rozpoznawanie jego potrzeb i proponowanie rozwiązań.',
        ],
    },
    {
        id: 6,
        nazwa: 'Podejmowanie decyzji i odpowiedzialność',
        descriptions: [
            'Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności potencjalnego ryzyka.',
            'Podejmowanie decyzji (decyzyjność).',
            'Przyjmowanie odpowiedzialności za efekty podjętych decyzji.',
        ],
    },
    {
        id: 7,
        nazwa: 'Radzenie sobie w sytuacjach kryzysowych',
        descriptions: [
            'Rozpoznawanie sytuacji kryzysowych i informowanie o nich zainteresowanych.',
            'Podejmowanie działań mających na celu rozwiązanie kryzysu.',
            'Wyciąganie wniosków z sytuacji kryzysowych.',
        ],
    },
    {
        id: 8,
        nazwa: 'Rzetelność',
        descriptions: [
            'Wykonywanie zadań zgodnie z obowiązującymi standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów.',
            'Dotrzymywanie zobowiązań (realizacja zadań) w wyznaczonym czasie.',
        ],
    },
    {
        id: 9,
        nazwa: 'Myślenie analityczne',
        descriptions: [
            'Rozróżnianie informacji istotnych i nieistotnych.',
            'Dostrzeganie zależności między informacjami.',
            'Formułowanie wniosków.',
        ],
    },
    {
        id: 10,
        nazwa: 'Wykorzystywanie wiedzy i doskonalenie zawodowe',
        descriptions: [
            'Wykorzystywanie wiedzy przy realizacji zadań na zajmowanym stanowisku pracy.',
            'Doskonalenie wiedzy i umiejętności niezbędnych do wykonywania zadań na zajmowanym stanowisku pracy, w szczególności wyszukiwanie i pozyskiwanie wiedzy, korzystanie z dobrych praktyk i doświadczeń innych.',
            'Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii.',
        ],
    },
    {
        id: 11,
        nazwa: 'Współpraca',
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
        nazwa: 'Wystąpienia publiczne',
        descriptions: [
            'Wykorzystywanie różnych środków przekazu (np. narzędzi multimedialnych) i dbałość o sposób prezentacji (w tym autoprezentacji).',
            'Nawiązywanie i utrzymywanie kontaktu z audytorium.',
            'Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych, elastyczne reagowanie na potrzeby audytorium.',
            'Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami.',
        ],
    },
    {
        id: 13,
        nazwa: 'Zarządzanie ludźmi',
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
        nazwa: 'Zarządzanie strategiczne',
        descriptions: [
            'Tworzenie wizji oraz wyznaczanie celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia oraz strategie rozwoju.',
            'Formułowanie celów operacyjnych na podstawie celów strategicznych.',
            'Analiza ryzyka planowanych działań o charakterze strategicznym.',
        ],
    },
].map((c) => ({ ...c, opis: c.descriptions.join('\n'), czy_aktywne: true }));

const SHEET_MANDATORY = {
    A: [13, 6, 4, 11, 1, 14],
    B: [13, 6, 4, 11, 1],
    C: [10, 8, 4, 11, 1],
};

const SHEET_CRITERIA = Object.fromEntries(
    ['A', 'B', 'C'].map((sheet) => {
        const mandatoryIds = CRITERIA_CATALOG.filter((c) => SHEET_MANDATORY[sheet].includes(c.id)).map((c) => c.id);
        const additionalIds = CRITERIA_CATALOG.filter((c) => !SHEET_MANDATORY[sheet].includes(c.id)).map((c) => c.id);
        return [sheet, { mandatoryIds, additionalIds }];
    })
);

const TAGS_CATALOG = [
    { id: 1, nazwa: '#JasnyPrzekaz', opis: 'mowa/pismo', kategoria: 'KOMPETENCYJNY', criteriaIds: [1, 12, 5] },
    { id: 2, nazwa: '#Argumentacja', opis: 'przekonywanie', kategoria: 'KOMPETENCYJNY', criteriaIds: [1, 3, 12] },
    { id: 3, nazwa: '#TaktIEmpatia', opis: 'szacunek/słuchanie', kategoria: 'KOMPETENCYJNY', criteriaIds: [5, 1, 11] },
    { id: 4, nazwa: '#PracaZespołowa', opis: 'wsparcie/atmosfera', kategoria: 'KOMPETENCYJNY', criteriaIds: [11, 13] },
    { id: 5, nazwa: '#TerminowośćIPriorytety', opis: 'czas/pilność', kategoria: 'KOMPETENCYJNY', criteriaIds: [4, 8, 12] },
    { id: 6, nazwa: '#JakośćIProcedury', opis: 'zgodność z prawem', kategoria: 'KOMPETENCYJNY', criteriaIds: [8, 10] },
    { id: 7, nazwa: '#ElastycznośćIStres', opis: 'presja/kryzys', kategoria: 'KOMPETENCYJNY', criteriaIds: [4, 7, 12] },
    { id: 8, nazwa: '#InicjatywaIInnowacja', opis: 'nowe pomysły', kategoria: 'KOMPETENCYJNY', criteriaIds: [2, 5, 10] },
    { id: 9, nazwa: '#AnalizaIRyzyko', opis: 'wnioski/ryzyko', kategoria: 'KOMPETENCYJNY', criteriaIds: [9, 6, 14] },
    { id: 10, nazwa: '#Decyzyjność', opis: 'odpowiedzialność', kategoria: 'KOMPETENCYJNY', criteriaIds: [6, 7] },
    { id: 11, nazwa: '#RozwójIWiedza', opis: 'szkolenia/technologia', kategoria: 'KOMPETENCYJNY', criteriaIds: [10, 11] },
    { id: 12, nazwa: '#DelegowanieIMonitoring', opis: 'podział zadań', kategoria: 'KOMPETENCYJNY', criteriaIds: [13, 4] },
    { id: 13, nazwa: '#MotywowanieIFeedback', opis: 'rozwój zespołu', kategoria: 'KOMPETENCYJNY', criteriaIds: [13] },
    { id: 14, nazwa: '#WizjaIStrategia', opis: 'cele strategiczne', kategoria: 'KOMPETENCYJNY', criteriaIds: [14, 3] },
    { id: 15, nazwa: '#Przeciążenie', opis: 'Dobrostan / HR Partner', kategoria: 'DOBROSTAN', criteriaIds: [] },
    { id: 16, nazwa: '#Nadgodziny', opis: 'Dobrostan / HR Partner', kategoria: 'DOBROSTAN', criteriaIds: [] },
].map((t) => ({
    ...t,
    isWellbeing: t.kategoria === 'DOBROSTAN',
    label: `${t.nazwa} (${t.opis})`,
}));

const ACTIVE_STATUSES = new Set([
    'WYZNACZANIE_KRYTERIOW',
    'OCZEKIWANIE_NA_PODPIS_KRYTERIOW',
    'W_TRAKCIE_OKRESU',
    'PRZED_ROZMOWA_OCENIAJACA',
    'SPORZADZONA_DO_PODPISU',
]);

const EDITABLE_SETUP_STATUSES = new Set([
    'WYZNACZANIE_KRYTERIOW',
    'OCZEKIWANIE_NA_PODPIS_KRYTERIOW',
    'W_TRAKCIE_OKRESU',
    'PRZED_ROZMOWA_OCENIAJACA',
]);

const ALLOWED_SCORES = new Set([1, 3, 5, 7, 9]);

function createError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function parseIsoDateUtc(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
}

function formatUtcIsoDate(dt) {
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function todayIso() {
    return formatUtcIsoDate(new Date());
}

function nowTs() {
    return new Date().toISOString();
}

function addDaysIso(dateStr, days) {
    const dt = parseIsoDateUtc(dateStr);
    if (!dt) return null;
    dt.setUTCDate(dt.getUTCDate() + Number(days));
    return formatUtcIsoDate(dt);
}

function addMonthsIso(dateStr, months) {
    const dt = parseIsoDateUtc(dateStr);
    if (!dt) return null;
    const originalDay = dt.getUTCDate();
    dt.setUTCDate(1);
    dt.setUTCMonth(dt.getUTCMonth() + Number(months));
    const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(originalDay, lastDay));
    return formatUtcIsoDate(dt);
}

function diffDaysIso(startStr, endStr) {
    const start = parseIsoDateUtc(startStr);
    const end = parseIsoDateUtc(endStr);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function calculateFinalResult(scoresInput) {
    const vals = Array.isArray(scoresInput) ? scoresInput : Object.values(scoresInput || {});
    let sum = 0;
    let hasOnePoint = false;
    for (const raw of vals) {
        const val = Number(raw);
        if (!ALLOWED_SCORES.has(val)) {
            throw createError(400, `Nieprawidłowa punktacja kryterium: ${raw}. Dozwolone wartości: 1, 3, 5, 7, 9.`);
        }
        sum += val;
        if (val === 1) hasOnePoint = true;
    }
    const avg = Number((sum / vals.length).toFixed(2));
    let poziom = 'ZNACZNIE_POWYZEJ_OCZEKIWAN';
    if (avg <= 2) poziom = 'ZNACZNIE_PONIZEJ_OCZEKIWAN';
    else if (avg <= 4) poziom = 'PONIZEJ_OCZEKIWAN';
    else if (avg <= 6) poziom = 'NA_POZIOMIE_OCZEKIWAN';
    else if (avg <= 8) poziom = 'POWYZEJ_OCZEKIWAN';
    const wynik = avg > 4 && !hasOnePoint ? 'POZYTYWNA' : 'NEGATYWNA';
    return {
        srednia_punktow: avg,
        poziom_oceny: poziom,
        poziom_oceny_label: LEVEL_LABELS[poziom],
        wynik_ogolny: wynik,
        hasOnePoint,
    };
}

function computeCriterionTagSuggestion(posCount, negCount) {
    const total = posCount + negCount;
    let suggestedScore = 5;
    let suggestedLabel = '5 pkt (Na poziomie oczekiwań)';
    if (total > 0) {
        const ratio = posCount / total;
        if (ratio >= 0.85 && posCount >= 3) {
            suggestedScore = 9;
            suggestedLabel = '9 pkt (Znacznie powyżej oczekiwań)';
        } else if (ratio >= 0.65 && posCount >= 1) {
            suggestedScore = 7;
            suggestedLabel = '7 pkt (Powyżej oczekiwań)';
        } else if (ratio >= 0.4) {
            suggestedScore = 5;
            suggestedLabel = '5 pkt (Na poziomie oczekiwań)';
        } else if (ratio > 0 || negCount <= 2) {
            suggestedScore = 3;
            suggestedLabel = '3 pkt (Poniżej oczekiwań)';
        } else {
            suggestedScore = 1;
            suggestedLabel = '1 pkt (Znacznie poniżej oczekiwań)';
        }
    }
    return { suggestedScore, suggestedLabel };
}

function checkAutoRankPromotion(currentRank, currentCalc, previousEval) {
    const rank = Number(currentRank);
    if (!Number.isInteger(rank) || rank < 1 || rank >= 9) return false;
    if (!currentCalc || currentCalc.wynik_ogolny !== 'POZYTYWNA') return false;
    if (Number(currentCalc.srednia_punktow) <= 6) return false;
    if (!previousEval || previousEval.wynik_ogolny !== 'POZYTYWNA') return false;
    return Number(previousEval.srednia_punktow) > 6;
}

function computeEmployeeAlerts({ activeEval, tasks = [], previousEval = null, today = todayIso() }) {
    const alerts = [];
    if (!activeEval) return alerts;

    const isAfterNeg = previousEval && previousEval.wynik_ogolny === 'NEGATYWNA';
    const limitDays = isAfterNeg ? 7 : 30;
    if (!activeEval.data_rozmowy_wstepnej) {
        alerts.push({
            type: 'warning',
            code: 'MISSING_INITIAL_INTERVIEW',
            title: 'Termin formalny',
            message: `Wymagana rozmowa wstępna w ciągu ${limitDays} dni (do ${activeEval.termin_wyznaczenia_kryteriow}).${isAfterNeg ? ' (Skrócony limit po ocenie negatywnej)' : ''}`,
        });
    }
    if (activeEval.status === 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW') {
        alerts.push({
            type: 'info',
            code: 'PENDING_CRITERIA_SIGNATURE',
            title: 'Oczekuje podpis pracownika',
            message: 'Kryteria zostały wyznaczone przez przełożonego i czekają na e-podpis ocenianego (Część I).',
        });
    }
    if (activeEval.status === 'SPORZADZONA_DO_PODPISU') {
        alerts.push({
            type: 'warning',
            code: 'PENDING_EVALUATION_SIGNATURE',
            title: 'Ocena gotowa do zapoznania',
            message: 'Ocena końcowa została sporządzona przez przełożonego i oczekuje na e-podpis ocenianego.',
        });
    }

    let posTotal = 0;
    let negTotal = 0;
    let wellbeingSignals = 0;
    for (const task of tasks) {
        for (const tg of task.tags || []) {
            if (tg.kategoria === 'DOBROSTAN') wellbeingSignals++;
            else if (tg.polaryzacja === '+') posTotal++;
            else if (tg.polaryzacja === '-') negTotal++;
        }
    }

    if (wellbeingSignals >= 1 || negTotal >= 3) {
        alerts.push({
            type: 'wellbeing',
            code: 'HR_PARTNER_OVERLOAD',
            title: 'Wirtualny HR Partner (Ryzyko przeciążenia / wypalenia)',
            message: `Wykryto sygnały dobrostanowe (#Przeciążenie / #Nadgodziny: ${wellbeingSignals}) oraz ${negTotal} uwag (-). Sugerowane działanie: zaplanuj rozmowę wspierającą, sprawdź podział zadań z zastępstwa i czasowo zmień priorytety.`,
        });
    } else if (posTotal >= 5) {
        alerts.push({
            type: 'positive',
            code: 'HR_PARTNER_APPRECIATION',
            title: 'Wirtualny HR Partner (Kultura doceniania)',
            message: `Pracownik zebrał aż ${posTotal} pozytywnych obserwacji (+). Warto docenić zaangażowanie krótką pochwałą na spotkaniu zespołu!`,
        });
    }

    if (activeEval.planowana_data_oceny) {
        const daysLeft = diffDaysIso(today, activeEval.planowana_data_oceny);
        if ((daysLeft !== null && daysLeft <= 60) || (today <= '2026-12-31' && activeEval.planowana_data_oceny <= '2026-12-31')) {
            alerts.push({
                type: 'info',
                code: 'APPROACHING_EVALUATION_DEADLINE',
                title: 'Zbliżający się koniec okresu oceny',
                message: `${activeEval.planowana_data_oceny} — otwórz profil i przejdź do kreatora oceny.`,
            });
        }
    }

    return alerts;
}

function slugifyEmail(name) {
    const map = {
        ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
        Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
    };
    const ascii = String(name || 'uzytkownik')
        .split('')
        .map((ch) => map[ch] || ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '');
    return `${ascii || 'uzytkownik'}@urzad.gov.pl`;
}

function formatUserRow(u) {
    const stopien = Number(u.aktualny_stopien_sluzbowy || 0);
    return {
        ...u,
        aktualny_stopien_sluzbowy: stopien,
        employmentType: stopien > 0 ? 'MIANOWANIE' : 'UMOWA_NIEOKRESLONA',
        rank: stopien > 0 ? stopien : null,
    };
}

function buildInitialMockDb() {
    const users = [
        {
            id: 1,
            imie_nazwisko: 'Marek Wiśniewski',
            email: 'marek.wisniewski@urzad.gov.pl',
            arkusz: 'A',
            rola: 'DYREKTOR',
            aktualny_stopien_sluzbowy: 7,
            nazwa_stanowiska: 'Dyrektor Generalny Urzędu',
            komorka_organizacyjna: 'Kierownictwo Urzędu',
            przelozony_id: null,
            created_at: '2024-01-01T08:00:00.000Z',
        },
        {
            id: 2,
            imie_nazwisko: 'Jan Kowalski',
            email: 'jan.kowalski@urzad.gov.pl',
            arkusz: 'B',
            rola: 'OCENIAJACY',
            aktualny_stopien_sluzbowy: 4,
            nazwa_stanowiska: 'Naczelnik Wydziału Analiz',
            komorka_organizacyjna: 'Wydział Analiz i Sprawozdawczości',
            przelozony_id: 1,
            created_at: '2024-01-01T08:00:00.000Z',
        },
        {
            id: 3,
            imie_nazwisko: 'Piotr Zieliński',
            email: 'piotr.zielinski@urzad.gov.pl',
            arkusz: 'C',
            rola: 'ADMIN',
            aktualny_stopien_sluzbowy: 0,
            nazwa_stanowiska: 'Administrator Systemu IT',
            komorka_organizacyjna: 'Biuro Informatyki',
            przelozony_id: 1,
            created_at: '2024-01-01T08:00:00.000Z',
        },
        {
            id: 4,
            imie_nazwisko: 'Anna Nowak',
            email: 'anna.nowak@urzad.gov.pl',
            arkusz: 'C',
            rola: 'OCENIANY',
            aktualny_stopien_sluzbowy: 2,
            nazwa_stanowiska: 'Starszy Specjalista ds. Analiz',
            komorka_organizacyjna: 'Wydział Analiz i Sprawozdawczości',
            przelozony_id: 2,
            created_at: '2024-01-01T08:00:00.000Z',
        },
        {
            id: 5,
            imie_nazwisko: 'Tomasz Mazur',
            email: 'tomasz.mazur@urzad.gov.pl',
            arkusz: 'C',
            rola: 'OCENIANY',
            aktualny_stopien_sluzbowy: 0,
            nazwa_stanowiska: 'Specjalista ds. Kontroli',
            komorka_organizacyjna: 'Wydział Analiz i Sprawozdawczości',
            przelozony_id: 2,
            created_at: '2024-01-01T08:00:00.000Z',
        },
    ];

    const evaluations = [
        {
            id: 1,
            pracownik_id: 4,
            oceniajacy_id: 2,
            typ_arkusza: 'C',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'ZAKONCZONA',
            data_rozpoczecia_cyklu: '2022-11-28',
            termin_wyznaczenia_kryteriow: '2022-12-28',
            data_rozmowy_wstepnej: '2022-12-10',
            planowana_data_oceny: '2024-11-28',
            data_rozmowy_oceniajacej: '2024-11-28',
            data_zapoznania_z_ocena: '2024-11-28',
            oczekiwania_i_cele: null,
            srednia_punktow: 7.4,
            poziom_oceny: 'POWYZEJ_OCZEKIWAN',
            wynik_ogolny: 'POZYTYWNA',
            uzasadnienie_oceny: 'Bardzo wysoka jakość analiz i wzorowa współpraca w zespole.',
            wnioski_iprz: 'Udział w szkoleniu z zaawansowanej analizy danych i wizualizacji.',
            podpis_kryteria_oceniajacy_at: '2022-12-10 10:00:00',
            podpis_kryteria_oceniany_at: '2022-12-10 10:05:00',
            podpis_ocena_oceniajacy_at: '2024-11-28 14:22:00',
            podpis_ocena_oceniany_at: '2024-11-28 14:22:00',
            created_at: '2022-11-28T08:00:00.000Z',
            updated_at: '2024-11-28T14:22:00.000Z',
        },
        {
            id: 2,
            pracownik_id: 5,
            oceniajacy_id: 2,
            typ_arkusza: 'C',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'ZAKONCZONA',
            data_rozpoczecia_cyklu: '2024-11-14',
            termin_wyznaczenia_kryteriow: '2024-12-14',
            data_rozmowy_wstepnej: '2024-11-25',
            planowana_data_oceny: '2026-11-14',
            data_rozmowy_oceniajacej: '2026-11-14',
            data_zapoznania_z_ocena: '2026-11-14',
            oczekiwania_i_cele: null,
            srednia_punktow: 3.4,
            poziom_oceny: 'PONIZEJ_OCZEKIWAN',
            wynik_ogolny: 'NEGATYWNA',
            uzasadnienie_oceny: 'Powtarzające się opóźnienia w realizacji protokołów kontrolnych oraz braki formalne.',
            wnioski_iprz: 'Szkolenie z zarządzania czasem oraz mentoring starszego specjalisty.',
            podpis_kryteria_oceniajacy_at: '2024-11-25 09:00:00',
            podpis_kryteria_oceniany_at: '2024-11-25 09:10:00',
            podpis_ocena_oceniajacy_at: '2026-11-14 11:05:00',
            podpis_ocena_oceniany_at: '2026-11-14 11:05:00',
            created_at: '2024-11-14T08:00:00.000Z',
            updated_at: '2026-11-14T11:05:00.000Z',
        },
        {
            id: 3,
            pracownik_id: 2,
            oceniajacy_id: 1,
            typ_arkusza: 'B',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'ZAKONCZONA',
            data_rozpoczecia_cyklu: '2022-12-20',
            termin_wyznaczenia_kryteriow: '2023-01-19',
            data_rozmowy_wstepnej: '2023-01-05',
            planowana_data_oceny: '2024-12-20',
            data_rozmowy_oceniajacej: '2024-12-20',
            data_zapoznania_z_ocena: '2024-12-20',
            oczekiwania_i_cele: null,
            srednia_punktow: 7.4,
            poziom_oceny: 'POWYZEJ_OCZEKIWAN',
            wynik_ogolny: 'POZYTYWNA',
            uzasadnienie_oceny: 'Skuteczne kierowanie wydziałem i wysoka decyzyjność.',
            wnioski_iprz: 'Warsztaty z zarządzania zmianą w administracji publicznej.',
            podpis_kryteria_oceniajacy_at: '2023-01-05 11:00:00',
            podpis_kryteria_oceniany_at: '2023-01-05 11:05:00',
            podpis_ocena_oceniajacy_at: '2024-12-20 09:40:00',
            podpis_ocena_oceniany_at: '2024-12-20 09:40:00',
            created_at: '2022-12-20T08:00:00.000Z',
            updated_at: '2024-12-20T09:40:00.000Z',
        },
        {
            id: 4,
            pracownik_id: 4,
            oceniajacy_id: 2,
            typ_arkusza: 'C',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'W_TRAKCIE_OKRESU',
            data_rozpoczecia_cyklu: '2024-12-01',
            termin_wyznaczenia_kryteriow: '2024-12-31',
            data_rozmowy_wstepnej: '2024-12-18',
            planowana_data_oceny: '2026-12-01',
            data_rozmowy_oceniajacej: null,
            data_zapoznania_z_ocena: null,
            oczekiwania_i_cele:
                'Omówiono przygotowywanie raportów kwartalnych oraz rozwój kompetencji analitycznych i obsługi interesanta.',
            srednia_punktow: null,
            poziom_oceny: null,
            wynik_ogolny: null,
            uzasadnienie_oceny: null,
            wnioski_iprz: null,
            podpis_kryteria_oceniajacy_at: '2024-12-18 10:15:00',
            podpis_kryteria_oceniany_at: '2024-12-18 10:15:00',
            podpis_ocena_oceniajacy_at: null,
            podpis_ocena_oceniany_at: null,
            created_at: '2024-12-01T08:00:00.000Z',
            updated_at: '2024-12-18T10:15:00.000Z',
        },
        {
            id: 5,
            pracownik_id: 5,
            oceniajacy_id: 2,
            typ_arkusza: 'C',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'WYZNACZANIE_KRYTERIOW',
            data_rozpoczecia_cyklu: '2026-11-16',
            termin_wyznaczenia_kryteriow: '2026-11-23',
            data_rozmowy_wstepnej: null,
            planowana_data_oceny: '2027-05-16',
            data_rozmowy_oceniajacej: null,
            data_zapoznania_z_ocena: null,
            oczekiwania_i_cele: null,
            srednia_punktow: null,
            poziom_oceny: null,
            wynik_ogolny: null,
            uzasadnienie_oceny: null,
            wnioski_iprz: null,
            podpis_kryteria_oceniajacy_at: null,
            podpis_kryteria_oceniany_at: null,
            podpis_ocena_oceniajacy_at: null,
            podpis_ocena_oceniany_at: null,
            created_at: '2026-11-16T08:00:00.000Z',
            updated_at: '2026-11-16T08:00:00.000Z',
        },
        {
            id: 6,
            pracownik_id: 2,
            oceniajacy_id: 1,
            typ_arkusza: 'B',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'W_TRAKCIE_OKRESU',
            data_rozpoczecia_cyklu: '2025-01-10',
            termin_wyznaczenia_kryteriow: '2025-02-09',
            data_rozmowy_wstepnej: '2025-01-25',
            planowana_data_oceny: '2027-01-10',
            data_rozmowy_oceniajacej: null,
            data_zapoznania_z_ocena: null,
            oczekiwania_i_cele: 'Priorytet: sprawne delegowanie zadań w powiększonym zespole i regularny feedback.',
            srednia_punktow: null,
            poziom_oceny: null,
            wynik_ogolny: null,
            uzasadnienie_oceny: null,
            wnioski_iprz: null,
            podpis_kryteria_oceniajacy_at: '2025-01-25 13:00:00',
            podpis_kryteria_oceniany_at: '2025-01-25 13:00:00',
            podpis_ocena_oceniajacy_at: null,
            podpis_ocena_oceniany_at: null,
            created_at: '2025-01-10T08:00:00.000Z',
            updated_at: '2025-01-25T13:00:00.000Z',
        },
        {
            id: 7,
            pracownik_id: 3,
            oceniajacy_id: 1,
            typ_arkusza: 'C',
            numer_podejscia: 1,
            poprzednia_ocena_id: null,
            status: 'WYZNACZANIE_KRYTERIOW',
            data_rozpoczecia_cyklu: '2025-03-01',
            termin_wyznaczenia_kryteriow: '2025-03-31',
            data_rozmowy_wstepnej: null,
            planowana_data_oceny: '2027-03-01',
            data_rozmowy_oceniajacej: null,
            data_zapoznania_z_ocena: null,
            oczekiwania_i_cele: null,
            srednia_punktow: null,
            poziom_oceny: null,
            wynik_ogolny: null,
            uzasadnienie_oceny: null,
            wnioski_iprz: null,
            podpis_kryteria_oceniajacy_at: null,
            podpis_kryteria_oceniany_at: null,
            podpis_ocena_oceniajacy_at: null,
            podpis_ocena_oceniany_at: null,
            created_at: '2025-03-01T08:00:00.000Z',
            updated_at: '2025-03-01T08:00:00.000Z',
        },
    ];

    const criteriaResults = [];
    let crId = 1;
    const addCritRows = (ocenaId, map) => {
        for (const [k, v] of Object.entries(map)) {
            criteriaResults.push({
                id: crId++,
                ocena_id: ocenaId,
                kryterium_id: Number(k),
                punkty: v,
                komentarz_czastkowy: null,
            });
        }
    };
    addCritRows(1, { 10: 7, 8: 7, 4: 7, 11: 9, 1: 7 });
    addCritRows(2, { 10: 5, 8: 3, 4: 3, 11: 3, 1: 3 });
    addCritRows(3, { 13: 7, 6: 7, 4: 7, 11: 9, 1: 7 });
    addCritRows(4, { 10: null, 8: null, 4: null, 11: null, 1: null, 9: null, 5: null });
    addCritRows(5, { 10: null, 8: null, 4: null, 11: null, 1: null, 7: null });
    addCritRows(6, { 13: null, 6: null, 4: null, 11: null, 1: null, 9: null });
    addCritRows(7, { 10: null, 8: null, 4: null, 11: null, 1: null });

    const tasks = [
        {
            id: 1,
            ocena_id: 4,
            autor_id: 2,
            tytul: 'Przygotowanie kwartalnego raportu budżetowego',
            opis: 'Zebranie danych z 4 wydziałów i opracowanie zestawienia dla Ministerstwa.',
            data_zdarzenia: '2025-09-14',
            widocznosc: 'OBIE_STRONY',
            created_at: '2025-09-14T10:00:00.000Z',
        },
        {
            id: 2,
            ocena_id: 4,
            autor_id: 2,
            tytul: 'Obsługa trudnego zapytania w trybie informacji publicznej',
            opis: 'Odpowiedź pisemna i konsultacja telefoniczna z interesantem.',
            data_zdarzenia: '2026-03-20',
            widocznosc: 'OBIE_STRONY',
            created_at: '2026-03-20T10:00:00.000Z',
        },
        {
            id: 3,
            ocena_id: 4,
            autor_id: 2,
            tytul: 'Wdrożenie nowego pracownika w system EZD',
            opis: 'Przekazanie wiedzy i opieka merytoryczna w pierwszym miesiącu.',
            data_zdarzenia: '2026-08-05',
            widocznosc: 'OBIE_STRONY',
            created_at: '2026-08-05T10:00:00.000Z',
        },
        {
            id: 4,
            ocena_id: 5,
            autor_id: 2,
            tytul: 'Kontrola dokumentacji projektowej (zastępstwo za kolegę na L4)',
            opis: 'Przejęcie pilnych teczek w trakcie wzmożonego okresu sprawozdawczego.',
            data_zdarzenia: '2026-09-18',
            widocznosc: 'OBIE_STRONY',
            created_at: '2026-09-18T10:00:00.000Z',
        },
        {
            id: 5,
            ocena_id: 5,
            autor_id: 2,
            tytul: 'Odpowiedź na wystąpienie pokontrolne',
            opis: 'Przygotowanie korekty załączników i uzgodnień prawnych.',
            data_zdarzenia: '2026-10-22',
            widocznosc: 'OBIE_STRONY',
            created_at: '2026-10-22T10:00:00.000Z',
        },
        {
            id: 6,
            ocena_id: 6,
            autor_id: 1,
            tytul: 'Reorganizacja pracy w Wydziale Analiz',
            opis: 'Nowy podział obowiązków i wdrożenie cotygodniowych spotkań statusowych.',
            data_zdarzenia: '2026-06-10',
            widocznosc: 'OBIE_STRONY',
            created_at: '2026-06-10T10:00:00.000Z',
        },
    ];

    const tagIdByName = Object.fromEntries(TAGS_CATALOG.map((t) => [t.nazwa, t.id]));
    let ttId = 1;
    const taskTags = [
        { id: ttId++, zadanie_id: 1, tag_id: tagIdByName['#JakośćIProcedury'], polaryzacja: '+', komentarz: 'Zero błędów formalnych, wzorowa zgodność z wytycznymi.' },
        { id: ttId++, zadanie_id: 1, tag_id: tagIdByName['#AnalizaIRyzyko'], polaryzacja: '+', komentarz: 'Szybko wychwyciła rozbieżność w kosztach terenowych.' },
        { id: ttId++, zadanie_id: 1, tag_id: tagIdByName['#TerminowośćIPriorytety'], polaryzacja: '+', komentarz: 'Raport oddany 2 dni przed terminem.' },
        { id: ttId++, zadanie_id: 2, tag_id: tagIdByName['#JasnyPrzekaz'], polaryzacja: '+', komentarz: 'Bardzo przejrzyste i zrozumiałe pismo urzędowe.' },
        { id: ttId++, zadanie_id: 2, tag_id: tagIdByName['#TaktIEmpatia'], polaryzacja: '+', komentarz: 'Spokojna, kulturalna rozmowa mimo dużych emocji interesanta.' },
        { id: ttId++, zadanie_id: 3, tag_id: tagIdByName['#PracaZespołowa'], polaryzacja: '+', komentarz: 'Chętnie pomagała i dbała o świetną atmosferę.' },
        { id: ttId++, zadanie_id: 3, tag_id: tagIdByName['#RozwójIWiedza'], polaryzacja: '+', komentarz: 'Opracowała krótką instrukcję PDF dla całego wydziału.' },
        { id: ttId++, zadanie_id: 3, tag_id: tagIdByName['#TerminowośćIPriorytety'], polaryzacja: '-', komentarz: 'Przez dodatkowe wsparcie opóźniła własną notatkę służbową o 1 dzień.' },
        { id: ttId++, zadanie_id: 4, tag_id: tagIdByName['#TerminowośćIPriorytety'], polaryzacja: '-', komentarz: 'Przekroczony termin oddania 2 protokołów kontrolnych.' },
        { id: ttId++, zadanie_id: 4, tag_id: tagIdByName['#ElastycznośćIStres'], polaryzacja: '-', komentarz: 'Widoczne duże zmęczenie i trudność z presją czasu.' },
        { id: ttId++, zadanie_id: 4, tag_id: tagIdByName['#Przeciążenie'], polaryzacja: '-', komentarz: 'Przejął pełen zakres obowiązków za nieobecnego współpracownika.' },
        { id: ttId++, zadanie_id: 5, tag_id: tagIdByName['#JakośćIProcedury'], polaryzacja: '-', komentarz: 'Drobne pomyłki w numeracji załączników wymagające poprawy.' },
        { id: ttId++, zadanie_id: 5, tag_id: tagIdByName['#Nadgodziny'], polaryzacja: '-', komentarz: 'Zostawał po godzinach 3 razy w tym samym tygodniu.' },
        { id: ttId++, zadanie_id: 5, tag_id: tagIdByName['#PracaZespołowa'], polaryzacja: '+', komentarz: 'Mimo zmęczenia bez problemu przekazał komplet akt koleżance.' },
        { id: ttId++, zadanie_id: 6, tag_id: tagIdByName['#DelegowanieIMonitoring'], polaryzacja: '+', komentarz: 'Jasny podział odpowiedzialności w zespole.' },
        { id: ttId++, zadanie_id: 6, tag_id: tagIdByName['#MotywowanieIFeedback'], polaryzacja: '+', komentarz: 'Regularne rozmowy wspierające z pracownikami.' },
        { id: ttId++, zadanie_id: 6, tag_id: tagIdByName['#Decyzyjność'], polaryzacja: '+', komentarz: 'Sprawne podjęcie decyzji o przesunięciu zasobów.' },
    ];

    const rankRequests = [
        {
            id: 1,
            ocena_id: 3,
            tryb_przyznania: 'FAKULTATYWNY',
            wnioskowany_stopien: 5,
            umotywowanie_przelozonego: 'Wzorowe wyniki wydziału w okresie sprawozdawczym i wdrożenie nowych standardów.',
            status_decyzji: 'OCZEKUJE',
            motywacja_dyrektora: null,
            data_decyzji: null,
        },
    ];

    return {
        seq: {
            users: 6,
            evaluations: 8,
            criteriaResults: crId,
            tasks: 7,
            taskTags: ttId,
            hrEvents: 1,
            appeals: 1,
            rankRequests: 2,
        },
        users,
        evaluations,
        criteriaResults,
        tasks,
        taskTags,
        hrEvents: [],
        appeals: [],
        rankRequests,
    };
}

let memoryDb = null;

function loadDb() {
    if (typeof localStorage !== 'undefined') {
        try {
            const raw = localStorage.getItem(MOCK_STORAGE_KEY);
            if (raw) {
                memoryDb = JSON.parse(raw);
                return memoryDb;
            }
        } catch {
            // Fall through to fresh seed
        }
    }
    if (!memoryDb) {
        memoryDb = buildInitialMockDb();
        saveDb(memoryDb);
    }
    return memoryDb;
}

function saveDb(db) {
    memoryDb = db;
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
        } catch {
            // Ignore quota errors
        }
    }
}

export function resetMockDb() {
    memoryDb = buildInitialMockDb();
    saveDb(memoryDb);
    return memoryDb;
}

function activeOrderRank(status) {
    if (status === 'PRZED_ROZMOWA_OCENIAJACA') return 0;
    if (status === 'SPORZADZONA_DO_PODPISU') return 1;
    return 2;
}

function getActiveEvalForUser(db, userId) {
    const active = db.evaluations.filter((e) => e.pracownik_id === userId && ACTIVE_STATUSES.has(e.status));
    active.sort((a, b) => {
        const diff = activeOrderRank(a.status) - activeOrderRank(b.status);
        return diff !== 0 ? diff : b.id - a.id;
    });
    return active[0] || null;
}

function getPastEvalsForUser(db, userId) {
    return db.evaluations
        .filter((e) => e.pracownik_id === userId && ['ZAKONCZONA', 'ODWOLANIE_W_TOKU', 'UNIEWAZNIONA'].includes(e.status))
        .sort((a, b) => {
            const da = a.data_zapoznania_z_ocena || a.data_rozmowy_oceniajacej || a.created_at.slice(0, 10);
            const dbDate = b.data_zapoznania_z_ocena || b.data_rozmowy_oceniajacej || b.created_at.slice(0, 10);
            const cmp = dbDate.localeCompare(da);
            return cmp !== 0 ? cmp : b.id - a.id;
        });
}

function hydrateTask(db, task) {
    const author = db.users.find((u) => u.id === task.autor_id);
    const tags = db.taskTags
        .filter((tt) => tt.zadanie_id === task.id)
        .map((tt) => {
            const def = TAGS_CATALOG.find((t) => t.id === tt.tag_id);
            return {
                ...tt,
                tag_nazwa: def ? def.nazwa : '',
                kategoria: def ? def.kategoria : 'KOMPETENCYJNY',
                tag_opis: def ? def.opis : '',
                kryteria_ids: def ? [...def.criteriaIds] : [],
            };
        });
    return {
        ...task,
        autor_nazwa: author ? author.imie_nazwisko : null,
        tags,
    };
}

function hydrateEvaluation(db, evalRow, { includePrivateTasks = true } = {}) {
    if (!evalRow) return null;
    const mandatorySet = new Set(SHEET_MANDATORY[evalRow.typ_arkusza] || []);
    const criteria = db.criteriaResults
        .filter((cr) => cr.ocena_id === evalRow.id)
        .map((cr) => {
            const def = CRITERIA_CATALOG.find((c) => c.id === cr.kryterium_id);
            return {
                ...cr,
                nazwa: def ? def.nazwa : `#${cr.kryterium_id}`,
                opis: def ? def.opis : '',
                descriptions: def ? [...def.descriptions] : [],
                typ_kryterium: mandatorySet.has(cr.kryterium_id) ? 'OBOWIAZKOWE' : 'DODATKOWE',
            };
        })
        .sort((a, b) => {
            const aMand = a.typ_kryterium === 'OBOWIAZKOWE' ? 0 : 1;
            const bMand = b.typ_kryterium === 'OBOWIAZKOWE' ? 0 : 1;
            return aMand !== bMand ? aMand - bMand : a.id - b.id;
        });

    const tasks = db.tasks
        .filter((t) => t.ocena_id === evalRow.id && (includePrivateTasks || t.widocznosc === 'OBIE_STRONY'))
        .sort((a, b) => {
            const cmp = b.data_zdarzenia.localeCompare(a.data_zdarzenia);
            return cmp !== 0 ? cmp : b.id - a.id;
        })
        .map((t) => hydrateTask(db, t));

    const hrEvents = db.hrEvents
        .filter((ev) => ev.ocena_id === evalRow.id)
        .sort((a, b) => {
            const cmp = b.data_od.localeCompare(a.data_od);
            return cmp !== 0 ? cmp : b.id - a.id;
        });

    const appeals = db.appeals.filter((ap) => ap.ocena_id === evalRow.id).sort((a, b) => b.id - a.id);
    const rankRequests = db.rankRequests.filter((rr) => rr.ocena_id === evalRow.id).sort((a, b) => b.id - a.id);

    return {
        ...evalRow,
        status_label: STATUS_LABELS[evalRow.status] || evalRow.status,
        poziom_oceny_label: evalRow.poziom_oceny ? LEVEL_LABELS[evalRow.poziom_oceny] || evalRow.poziom_oceny : null,
        criteria,
        tasks,
        hrEvents,
        appeals,
        rankRequests,
    };
}

function createActiveCycleInDb(
    db,
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
    const interviewDays = isAfterNegative ? 7 : 30;
    const cycleMonths = isAfterNegative ? 6 : 24;
    const newEval = {
        id: db.seq.evaluations++,
        pracownik_id: pracownikId,
        oceniajacy_id: oceniajacyId,
        typ_arkusza: typArkusza,
        numer_podejscia: numerPodejscia,
        poprzednia_ocena_id: poprzedniaOcenaId,
        status,
        data_rozpoczecia_cyklu: startDate,
        termin_wyznaczenia_kryteriow: addDaysIso(startDate, interviewDays),
        data_rozmowy_wstepnej: null,
        planowana_data_oceny: addMonthsIso(startDate, cycleMonths),
        data_rozmowy_oceniajacej: null,
        data_zapoznania_z_ocena: null,
        oczekiwania_i_cele: null,
        srednia_punktow: null,
        poziom_oceny: null,
        wynik_ogolny: null,
        uzasadnienie_oceny: null,
        wnioski_iprz: null,
        podpis_kryteria_oceniajacy_at: null,
        podpis_kryteria_oceniany_at: null,
        podpis_ocena_oceniajacy_at: null,
        podpis_ocena_oceniany_at: null,
        created_at: nowTs(),
        updated_at: nowTs(),
    };
    db.evaluations.push(newEval);

    const critIds =
        Array.isArray(criteriaIdsOverride) && criteriaIdsOverride.length > 0
            ? criteriaIdsOverride
            : SHEET_CRITERIA[typArkusza].mandatoryIds;

    for (const cid of critIds) {
        db.criteriaResults.push({
            id: db.seq.criteriaResults++,
            ocena_id: newEval.id,
            kryterium_id: cid,
            punkty: null,
            komentarz_czastkowy: null,
        });
    }
    return newEval;
}

function getCurrentUserOrThrow(db, currentUserId) {
    if (!currentUserId) throw createError(401, 'Wymagany wybór aktywnego konta.');
    const user = db.users.find((u) => u.id === Number(currentUserId));
    if (!user) throw createError(401, 'Wybrany użytkownik nie istnieje.');
    return user;
}

function assertCanEvaluate(currentUser, evalRow) {
    const allowed =
        currentUser.id === evalRow.oceniajacy_id ||
        currentUser.rola === 'DYREKTOR' ||
        currentUser.rola === 'ADMIN';
    if (!allowed || currentUser.rola === 'OCENIANY') {
        throw createError(403, 'Tylko przypisany oceniający lub Dyrektor może wykonać tę operację.');
    }
}

function prepareBatchTaskTags(rawTags, batchComment = '') {
    if (!Array.isArray(rawTags) || rawTags.length === 0) {
        throw createError(400, 'Wybierz przynajmniej jeden tag do przypisania.');
    }
    const normalizedBatchComment = String(batchComment || '').trim() || null;
    const prepared = [];

    for (const item of rawTags) {
        if (!item || typeof item !== 'object') {
            throw createError(400, 'Nieprawidłowy element na liście tagów.');
        }
        const tagDef = item.tag_id
            ? TAGS_CATALOG.find((t) => t.id === Number(item.tag_id))
            : item.tag_nazwa
              ? TAGS_CATALOG.find((t) => t.nazwa === String(item.tag_nazwa))
              : null;
        if (!tagDef) throw createError(400, 'Wybrany tag nie istnieje w słowniku.');

        let normPol =
            item.polaryzacja === '+' || item.polaryzacja === 'pos'
                ? '+'
                : item.polaryzacja === '-' || item.polaryzacja === 'neg'
                  ? '-'
                  : null;
        if (tagDef.kategoria === 'DOBROSTAN') normPol = '-';
        if (!normPol) {
            throw createError(400, "Nieprawidłowa polaryzacja tagu (dozwolone: '+' lub '-').");
        }

        const itemComment =
            item.komentarz !== undefined && item.komentarz !== null && String(item.komentarz).trim() !== ''
                ? String(item.komentarz).trim()
                : normalizedBatchComment;

        prepared.push({
            tagDef,
            polaryzacja: normPol,
            komentarz: itemComment,
        });
    }

    return prepared;
}

function insertPreparedTaskTags(db, taskId, preparedTags) {
    const inserted = [];
    for (const entry of preparedTags) {
        const row = {
            id: db.seq.taskTags++,
            zadanie_id: taskId,
            tag_id: entry.tagDef.id,
            polaryzacja: entry.polaryzacja,
            komentarz: entry.komentarz,
        };
        db.taskTags.push(row);
        inserted.push({
            ...row,
            tag_nazwa: entry.tagDef.nazwa,
            kategoria: entry.tagDef.kategoria,
            tag_opis: entry.tagDef.opis,
        });
    }
    return inserted;
}

export const mockApi = {
    async getDictionaries() {
        return {
            criteria: CRITERIA_CATALOG,
            sheetCriteria: SHEET_CRITERIA,
            tags: TAGS_CATALOG,
            legalConfig: LEGAL_CONFIG,
            scoreScale: SCORE_SCALE,
            levelLabels: LEVEL_LABELS,
            statusLabels: STATUS_LABELS,
            appealDecisionLabels: APPEAL_DECISION_LABELS,
            rankStatusLabels: RANK_STATUS_LABELS,
            eventTypeLabels: EVENT_TYPE_LABELS,
            iprzSuggestions: IPRZ_SUGGESTIONS_BY_CRITERION,
        };
    },

    async getUsers() {
        const db = loadDb();
        const roleOrder = { OCENIANY: 0, OCENIAJACY: 1, DYREKTOR: 2, ADMIN: 3 };
        const sorted = [...db.users].sort((a, b) => {
            const diff = (roleOrder[a.rola] ?? 4) - (roleOrder[b.rola] ?? 4);
            return diff !== 0 ? diff : a.id - b.id;
        });

        const users = sorted.map((u) => {
            const base = formatUserRow(u);
            const active = getActiveEvalForUser(db, base.id);
            const past = getPastEvalsForUser(db, base.id);
            const prevCompleted = past.find((e) => e.status === 'ZAKONCZONA') || null;
            const tasks = active
                ? db.tasks.filter((t) => t.ocena_id === active.id).map((t) => hydrateTask(db, t))
                : [];

            let posTagCount = 0;
            let negTagCount = 0;
            let wellbeingTagCount = 0;
            for (const t of tasks) {
                for (const tg of t.tags) {
                    if (tg.kategoria === 'DOBROSTAN') wellbeingTagCount++;
                    else if (tg.polaryzacja === '+') posTagCount++;
                    else if (tg.polaryzacja === '-') negTagCount++;
                }
            }

            return {
                ...base,
                activeEvaluationId: active ? active.id : null,
                activeStatus: active ? active.status : null,
                cycleStartDate: active ? active.data_rozpoczecia_cyklu : null,
                cycleEndDate: active ? active.planowana_data_oceny : null,
                interviewDeadline: active ? active.termin_wyznaczenia_kryteriow : null,
                initialInterviewDate: active ? active.data_rozmowy_wstepnej : null,
                posTagCount,
                negTagCount,
                wellbeingTagCount,
                alerts: active
                    ? computeEmployeeAlerts({ activeEval: active, tasks, previousEval: prevCompleted })
                    : [],
            };
        });

        return { users };
    },

    async getWorkspace(userId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const empId = Number(userId);
        const empRow = db.users.find((u) => u.id === empId);
        if (!empRow) throw createError(404, 'Użytkownik nie istnieje.');
        const user = formatUserRow(empRow);

        const canAccess =
            currentUser.id === empId ||
            currentUser.id === user.przelozony_id ||
            currentUser.rola === 'DYREKTOR' ||
            currentUser.rola === 'ADMIN' ||
            db.evaluations.some((e) => e.pracownik_id === empId && e.oceniajacy_id === currentUser.id);
        if (!canAccess) {
            throw createError(403, 'Brak dostępu do przestrzeni roboczej tego pracownika.');
        }

        const isSelfOnly = currentUser.id === empId;
        const evalRow = user.przelozony_id ? db.users.find((u) => u.id === user.przelozony_id) : null;
        const evaluator = evalRow ? formatUserRow(evalRow) : null;

        const activeRow = getActiveEvalForUser(db, empId);
        const activeEvaluation = activeRow
            ? hydrateEvaluation(db, activeRow, { includePrivateTasks: !isSelfOnly })
            : null;
        const pastEvaluations = getPastEvalsForUser(db, empId).map((row) =>
            hydrateEvaluation(db, row, { includePrivateTasks: !isSelfOnly })
        );

        const tagSummariesByCriterion = {};
        if (activeEvaluation) {
            for (const crit of activeEvaluation.criteria) {
                let posCount = 0;
                let negCount = 0;
                const entries = [];
                for (const task of activeEvaluation.tasks) {
                    for (const tg of task.tags) {
                        if (tg.kategoria !== 'DOBROSTAN' && tg.kryteria_ids.includes(crit.kryterium_id)) {
                            if (tg.polaryzacja === '+') posCount++;
                            else negCount++;
                            entries.push({
                                taskId: task.id,
                                taskTitle: task.tytul,
                                taskDate: task.data_zdarzenia,
                                tagId: tg.tag_nazwa,
                                polarity: tg.polaryzacja,
                                comment: tg.komentarz,
                            });
                        }
                    }
                }
                tagSummariesByCriterion[crit.kryterium_id] = {
                    posCount,
                    negCount,
                    total: posCount + negCount,
                    entries,
                    ...computeCriterionTagSuggestion(posCount, negCount),
                };
            }
        }

        const lastCompleted = pastEvaluations.find((e) => e.status === 'ZAKONCZONA') || null;
        const alerts = activeEvaluation
            ? computeEmployeeAlerts({
                  activeEval: activeEvaluation,
                  tasks: activeEvaluation.tasks,
                  previousEval: lastCompleted,
              })
            : [];

        const previousEvalEligibleForAutoPromotion = Boolean(
            lastCompleted &&
                lastCompleted.wynik_ogolny === 'POZYTYWNA' &&
                Number(lastCompleted.srednia_punktow) > 6 &&
                user.employmentType === 'MIANOWANIE' &&
                user.aktualny_stopien_sluzbowy < 9
        );

        return {
            user,
            evaluator,
            activeEvaluation,
            pastEvaluations,
            tagSummariesByCriterion,
            alerts,
            previousEvalEligibleForAutoPromotion,
        };
    },

    async createUser(payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        if (currentUser.rola !== 'ADMIN') {
            throw createError(403, 'Brak uprawnień do wykonania tej operacji (wymagana rola: ADMIN).');
        }

        const {
            imie_nazwisko,
            email,
            arkusz,
            rola,
            aktualny_stopien_sluzbowy = 0,
            nazwa_stanowiska,
            komorka_organizacyjna = 'Nowa komórka organizacyjna',
            przelozony_id = null,
        } = payload || {};

        if (!imie_nazwisko || !String(imie_nazwisko).trim()) throw createError(400, 'Pole imie_nazwisko jest wymagane.');
        if (!nazwa_stanowiska || !String(nazwa_stanowiska).trim()) throw createError(400, 'Pole nazwa_stanowiska jest wymagane.');
        if (!['OCENIANY', 'OCENIAJACY', 'DYREKTOR', 'ADMIN'].includes(rola)) {
            throw createError(400, 'Nieprawidłowa rola użytkownika.');
        }

        let finalEmail = email && String(email).trim().toLowerCase();
        if (!finalEmail) {
            const base = slugifyEmail(imie_nazwisko);
            const [localPart, domain] = base.split('@');
            finalEmail = base;
            let suffix = 2;
            while (db.users.some((u) => u.email === finalEmail)) {
                finalEmail = `${localPart}${suffix}@${domain}`;
                suffix++;
            }
        } else if (db.users.some((u) => u.email === finalEmail)) {
            throw createError(409, 'Konflikt unikalności danych (email już istnieje).');
        }

        const evaluatorId = przelozony_id ? Number(przelozony_id) : null;
        const newRow = {
            id: db.seq.users++,
            imie_nazwisko: String(imie_nazwisko).trim(),
            email: finalEmail,
            arkusz: arkusz || null,
            rola,
            aktualny_stopien_sluzbowy: Number(aktualny_stopien_sluzbowy || 0),
            nazwa_stanowiska: String(nazwa_stanowiska).trim(),
            komorka_organizacyjna: String(komorka_organizacyjna || 'Nowa komórka organizacyjna').trim(),
            przelozony_id: evaluatorId,
            created_at: nowTs(),
        };
        db.users.push(newRow);

        let activeEvaluation = null;
        if (evaluatorId && newRow.arkusz && newRow.rola !== 'DYREKTOR') {
            activeEvaluation = createActiveCycleInDb(db, {
                pracownikId: newRow.id,
                oceniajacyId: evaluatorId,
                typArkusza: newRow.arkusz,
            });
        }
        saveDb(db);
        return { user: formatUserRow(newRow), activeEvaluation };
    },

    async changeEvaluator(userId, przelozony_id, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        if (currentUser.rola !== 'ADMIN') {
            throw createError(403, 'Brak uprawnień do wykonania tej operacji (wymagana rola: ADMIN).');
        }

        const uid = Number(userId);
        const newEvalId = przelozony_id === null || przelozony_id === '' || przelozony_id === undefined ? null : Number(przelozony_id);
        if (newEvalId === uid) throw createError(400, 'Pracownik nie może być własnym przełożonym.');

        const target = db.users.find((u) => u.id === uid);
        if (!target) throw createError(404, 'Użytkownik nie istnieje.');

        let newEvaluatorName = null;
        if (newEvalId !== null) {
            const ev = db.users.find((u) => u.id === newEvalId);
            if (!ev) throw createError(400, 'Wybrany przełożony nie istnieje.');
            if (!['OCENIAJACY', 'DYREKTOR'].includes(ev.rola)) {
                throw createError(400, 'Przełożony musi mieć rolę OCENIAJACY lub DYREKTOR.');
            }
            newEvaluatorName = ev.imie_nazwisko;
        }

        target.przelozony_id = newEvalId;
        const active = getActiveEvalForUser(db, uid);
        let loggedEvent = null;
        if (active && newEvalId !== null && active.oceniajacy_id !== newEvalId) {
            active.oceniajacy_id = newEvalId;
            active.updated_at = nowTs();
            loggedEvent = {
                id: db.seq.hrEvents++,
                ocena_id: active.id,
                typ_zdarzenia: 'ZMIANA_OCENIAJACEGO',
                data_od: todayIso(),
                data_do: null,
                dni_przesuniecia_terminu: 0,
                opis: `Zmiana oceniającego na: ${newEvaluatorName}`,
            };
            db.hrEvents.push(loggedEvent);
        } else if (!active && newEvalId !== null && target.arkusz && target.rola !== 'DYREKTOR') {
            createActiveCycleInDb(db, {
                pracownikId: target.id,
                oceniajacyId: newEvalId,
                typArkusza: target.arkusz,
            });
        }

        saveDb(db);
        return { user: formatUserRow(target), loggedEvent };
    },

    async getEvaluations(params = {}, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        let list = [...db.evaluations];

        if (currentUser.rola === 'OCENIANY') {
            list = list.filter((e) => e.pracownik_id === currentUser.id);
        } else if (currentUser.rola === 'OCENIAJACY') {
            list = list.filter((e) => e.oceniajacy_id === currentUser.id || e.pracownik_id === currentUser.id);
        }

        if (params.pracownikId) list = list.filter((e) => e.pracownik_id === Number(params.pracownikId));
        if (params.oceniajacyId) list = list.filter((e) => e.oceniajacy_id === Number(params.oceniajacyId));
        if (params.status) list = list.filter((e) => e.status === params.status);
        else if (params.completedOnly === 'true') {
            list = list.filter((e) =>
                ['SPORZADZONA_DO_PODPISU', 'ZAKONCZONA', 'ODWOLANIE_W_TOKU', 'UNIEWAZNIONA'].includes(e.status)
            );
        }

        const evaluations = list
            .sort((a, b) => b.id - a.id)
            .map((ev) => {
                const p = db.users.find((u) => u.id === ev.pracownik_id);
                const o = db.users.find((u) => u.id === ev.oceniajacy_id);
                const hydrated = hydrateEvaluation(db, ev, { includePrivateTasks: true });
                return {
                    ...hydrated,
                    pracownik_nazwa: p ? p.imie_nazwisko : '',
                    pracownik_stanowisko: p ? p.nazwa_stanowiska : '',
                    oceniajacy_nazwa: o ? o.imie_nazwisko : '',
                    oceniajacy_stanowisko: o ? o.nazwa_stanowiska : '',
                };
            });

        return { evaluations };
    },

    async getEvaluation(evalId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        const includePrivateTasks = currentUser.id !== ev.pracownik_id;
        return { evaluation: hydrateEvaluation(db, ev, { includePrivateTasks }) };
    },

    async saveSetup(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        assertCanEvaluate(currentUser, ev);

        if (!EDITABLE_SETUP_STATUSES.has(ev.status)) {
            throw createError(400, `Nie można edytować kryteriów w statusie ${ev.status}.`);
        }

        const {
            data_rozmowy_wstepnej = null,
            oczekiwania_i_cele = '',
            additionalCriteriaIds = [],
            signByEvaluator = false,
        } = payload || {};

        const uniqueAdditional = [...new Set(additionalCriteriaIds.map((x) => Number(x)))];
        if (uniqueAdditional.length > 3) {
            throw createError(400, 'Możesz wybrać maksymalnie 3 kryteria dodatkowe.');
        }

        const sheetCfg = SHEET_CRITERIA[ev.typ_arkusza];
        for (const addId of uniqueAdditional) {
            if (!sheetCfg.additionalIds.includes(addId)) {
                throw createError(400, `Kryterium ${addId} nie jest dozwolonym kryterium dodatkowym dla Arkusza ${ev.typ_arkusza}.`);
            }
        }

        const targetIds = new Set([...sheetCfg.mandatoryIds, ...uniqueAdditional]);
        db.criteriaResults = db.criteriaResults.filter(
            (cr) => !(cr.ocena_id === ev.id && !targetIds.has(cr.kryterium_id))
        );
        for (const cid of targetIds) {
            const exists = db.criteriaResults.some((cr) => cr.ocena_id === ev.id && cr.kryterium_id === cid);
            if (!exists) {
                db.criteriaResults.push({
                    id: db.seq.criteriaResults++,
                    ocena_id: ev.id,
                    kryterium_id: cid,
                    punkty: null,
                    komentarz_czastkowy: null,
                });
            }
        }

        ev.data_rozmowy_wstepnej = data_rozmowy_wstepnej ? String(data_rozmowy_wstepnej) : null;
        ev.oczekiwania_i_cele = String(oczekiwania_i_cele || '').trim() || null;
        if (signByEvaluator) {
            if (!ev.podpis_kryteria_oceniajacy_at) ev.podpis_kryteria_oceniajacy_at = nowTs();
            ev.status = ev.podpis_kryteria_oceniany_at ? 'W_TRAKCIE_OKRESU' : 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW';
        }
        ev.updated_at = nowTs();

        saveDb(db);
        return { evaluation: hydrateEvaluation(db, ev, { includePrivateTasks: true }) };
    },

    async signCriteria(evalId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        if (currentUser.id !== ev.pracownik_id) {
            throw createError(403, 'Tylko oceniany pracownik może podpisać kryteria oceny.');
        }
        if (!ev.podpis_kryteria_oceniajacy_at) {
            throw createError(400, 'Oceniający musi najpierw zatwierdzić kryteria (e-podpis Części I).');
        }
        if (!ev.podpis_kryteria_oceniany_at) ev.podpis_kryteria_oceniany_at = nowTs();
        if (['WYZNACZANIE_KRYTERIOW', 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW'].includes(ev.status)) {
            ev.status = 'W_TRAKCIE_OKRESU';
        }
        ev.updated_at = nowTs();
        saveDb(db);
        return { evaluation: hydrateEvaluation(db, ev, { includePrivateTasks: false }) };
    },

    async startReview(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        assertCanEvaluate(currentUser, ev);
        ev.status = 'PRZED_ROZMOWA_OCENIAJACA';
        if (payload && payload.data_rozmowy_oceniajacej) {
            ev.data_rozmowy_oceniajacej = String(payload.data_rozmowy_oceniajacej);
        }
        ev.updated_at = nowTs();
        saveDb(db);
        return { evaluation: hydrateEvaluation(db, ev, { includePrivateTasks: true }) };
    },

    async finalizeEvaluation(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        assertCanEvaluate(currentUser, ev);

        if (!EDITABLE_SETUP_STATUSES.has(ev.status)) {
            throw createError(400, `Ocena została już sporządzona lub zamknięta (status: ${ev.status}).`);
        }

        const {
            scores = {},
            uzasadnienie_oceny = '',
            wnioski_iprz = '',
            data_rozmowy_oceniajacej = null,
            requestRankPromotion = false,
            rankPromotionMotivation = '',
        } = payload || {};

        const critRows = db.criteriaResults.filter((cr) => cr.ocena_id === ev.id);
        const scoreValues = [];
        for (const row of critRows) {
            const raw = scores[row.kryterium_id] ?? scores[String(row.kryterium_id)];
            if (raw === undefined || raw === null) {
                throw createError(400, `Brak oceny punktowej dla kryterium ID ${row.kryterium_id}.`);
            }
            const val = typeof raw === 'object' ? Number(raw.punkty) : Number(raw);
            scoreValues.push(val);
        }

        const calc = calculateFinalResult(scoreValues);
        const trimmedJustif = String(uzasadnienie_oceny || '').trim();
        if (calc.wynik_ogolny === 'NEGATYWNA' && !trimmedJustif) {
            throw createError(400, 'Blokada podpisu: przy ocenie NEGATYWNEJ uzasadnienie oceny jest obowiązkowe!');
        }

        for (const row of critRows) {
            const raw = scores[row.kryterium_id] ?? scores[String(row.kryterium_id)];
            row.punkty = typeof raw === 'object' ? Number(raw.punkty) : Number(raw);
            if (typeof raw === 'object' && raw.komentarz_czastkowy) {
                row.komentarz_czastkowy = String(raw.komentarz_czastkowy).trim();
            }
        }

        ev.srednia_punktow = calc.srednia_punktow;
        ev.poziom_oceny = calc.poziom_oceny;
        ev.wynik_ogolny = calc.wynik_ogolny;
        ev.uzasadnienie_oceny = trimmedJustif || null;
        ev.wnioski_iprz = String(wnioski_iprz || '').trim() || null;
        ev.data_rozmowy_oceniajacej = data_rozmowy_oceniajacej || ev.data_rozmowy_oceniajacej || todayIso();
        ev.podpis_ocena_oceniajacy_at = nowTs();
        ev.status = 'SPORZADZONA_DO_PODPISU';
        ev.updated_at = nowTs();

        const emp = db.users.find((u) => u.id === ev.pracownik_id);
        const prevEval = getPastEvalsForUser(db, ev.pracownik_id).find((e) => e.id !== ev.id && e.status === 'ZAKONCZONA') || null;
        const autoRankPromotionPending = checkAutoRankPromotion(emp.aktualny_stopien_sluzbowy, calc, prevEval);

        if (
            requestRankPromotion &&
            !autoRankPromotionPending &&
            calc.wynik_ogolny === 'POZYTYWNA' &&
            emp.aktualny_stopien_sluzbowy >= 1 &&
            emp.aktualny_stopien_sluzbowy < 9
        ) {
            const exists = db.rankRequests.some((rr) => rr.ocena_id === ev.id && rr.status_decyzji === 'OCZEKUJE');
            if (!exists) {
                db.rankRequests.push({
                    id: db.seq.rankRequests++,
                    ocena_id: ev.id,
                    tryb_przyznania: 'FAKULTATYWNY',
                    wnioskowany_stopien: emp.aktualny_stopien_sluzbowy + 1,
                    umotywowanie_przelozonego:
                        String(rankPromotionMotivation || '').trim() ||
                        trimmedJustif ||
                        'Pozytywna ocena okresowa oraz wysokie zaangażowanie.',
                    status_decyzji: 'OCZEKUJE',
                    motywacja_dyrektora: null,
                    data_decyzji: null,
                });
            }
        }

        saveDb(db);
        return {
            evaluation: hydrateEvaluation(db, ev, { includePrivateTasks: true }),
            autoRankPromotionPending,
        };
    },

    async acknowledgeEvaluation(evalId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        if (currentUser.id !== ev.pracownik_id) {
            throw createError(403, 'Tylko oceniany pracownik może potwierdzić zapoznanie się z oceną.');
        }
        if (ev.status !== 'SPORZADZONA_DO_PODPISU') {
            throw createError(400, `Ocena nie oczekuje na zapoznanie się (aktualny status: ${ev.status}).`);
        }

        ev.podpis_ocena_oceniany_at = nowTs();
        ev.data_zapoznania_z_ocena = todayIso();
        ev.status = 'ZAKONCZONA';
        ev.updated_at = nowTs();

        const emp = db.users.find((u) => u.id === ev.pracownik_id);
        const prevEval = getPastEvalsForUser(db, ev.pracownik_id).find((e) => e.id !== ev.id && e.status === 'ZAKONCZONA') || null;
        let autoRankPromoted = false;
        let newRank = emp.aktualny_stopien_sluzbowy;

        if (checkAutoRankPromotion(emp.aktualny_stopien_sluzbowy, ev, prevEval)) {
            newRank = emp.aktualny_stopien_sluzbowy + 1;
            emp.aktualny_stopien_sluzbowy = newRank;
            db.rankRequests.push({
                id: db.seq.rankRequests++,
                ocena_id: ev.id,
                tryb_przyznania: 'OBLIGATORYJNY',
                wnioskowany_stopien: newRank,
                umotywowanie_przelozonego: 'Awans obligatoryjny z mocy prawa — dwie kolejne oceny pozytywne powyżej 6 pkt.',
                status_decyzji: 'ZATWIERDZONY',
                motywacja_dyrektora: 'Przyznano automatycznie zgodnie z ustawą o służbie cywilnej.',
                data_decyzji: todayIso(),
            });
            autoRankPromoted = true;
        }

        const hasOtherActive = db.evaluations.some(
            (e) => e.pracownik_id === emp.id && e.id !== ev.id && ACTIVE_STATUSES.has(e.status)
        );
        let nextEvaluation = null;
        if (!hasOtherActive && emp.przelozony_id && emp.arkusz && emp.rola !== 'DYREKTOR') {
            nextEvaluation = createActiveCycleInDb(db, {
                pracownikId: emp.id,
                oceniajacyId: emp.przelozony_id,
                typArkusza: emp.arkusz,
                isAfterNegative: ev.wynik_ogolny === 'NEGATYWNA',
            });
        }

        saveDb(db);
        return {
            evaluation: hydrateEvaluation(db, ev, { includePrivateTasks: false }),
            autoRankPromoted,
            newRank: newRank > 0 ? newRank : null,
            nextEvaluation,
        };
    },

    async createTask(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        assertCanEvaluate(currentUser, ev);

        const {
            tytul,
            opis = '',
            data_zdarzenia = todayIso(),
            widocznosc = 'OBIE_STRONY',
            tags = [],
            komentarz = '',
        } = payload || {};
        if (!tytul || !String(tytul).trim()) throw createError(400, 'Tytuł zadania/obserwacji jest wymagany.');
        if (!['OBIE_STRONY', 'TYLKO_MENEDZER'].includes(widocznosc)) {
            throw createError(400, 'Nieprawidłowa widoczność.');
        }
        if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
            throw createError(400, 'Pole tags musi być tablicą.');
        }

        // Pre-validate batch tags atomically before mutating db
        const preparedTags = Array.isArray(tags) && tags.length > 0 ? prepareBatchTaskTags(tags, komentarz) : [];

        const newTask = {
            id: db.seq.tasks++,
            ocena_id: ev.id,
            autor_id: currentUser.id,
            tytul: String(tytul).trim(),
            opis: String(opis || '').trim() || null,
            data_zdarzenia: String(data_zdarzenia || todayIso()),
            widocznosc,
            created_at: nowTs(),
        };
        db.tasks.push(newTask);

        const insertedTags = insertPreparedTaskTags(db, newTask.id, preparedTags);
        saveDb(db);
        return { task: { ...newTask, tags: insertedTags } };
    },

    async deleteTask(taskId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const idx = db.tasks.findIndex((t) => t.id === Number(taskId));
        if (idx === -1) throw createError(404, 'Zadanie nie istnieje.');
        const ev = db.evaluations.find((e) => e.id === db.tasks[idx].ocena_id);
        assertCanEvaluate(currentUser, ev);
        const removedId = db.tasks[idx].id;
        db.tasks.splice(idx, 1);
        db.taskTags = db.taskTags.filter((tt) => tt.zadanie_id !== removedId);
        saveDb(db);
        return { deleted: true, id: removedId };
    },

    async addTagToTask(taskId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const task = db.tasks.find((t) => t.id === Number(taskId));
        if (!task) throw createError(404, 'Zadanie nie istnieje.');
        const ev = db.evaluations.find((e) => e.id === task.ocena_id);
        assertCanEvaluate(currentUser, ev);

        const body = payload || {};
        const isBatch = Object.prototype.hasOwnProperty.call(body, 'tags');
        const rawTags = isBatch
            ? body.tags
            : [
                  {
                      tag_id: body.tag_id,
                      tag_nazwa: body.tag_nazwa,
                      polaryzacja: body.polaryzacja,
                      komentarz: body.komentarz,
                  },
              ];

        const prepared = prepareBatchTaskTags(rawTags, body.komentarz || '');
        const taskTags = insertPreparedTaskTags(db, task.id, prepared);
        saveDb(db);
        return { taskTags, taskTag: taskTags[0] };
    },

    async deleteTaskTag(taskId, taskTagId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const idx = db.taskTags.findIndex((tt) => tt.id === Number(taskTagId) && tt.zadanie_id === Number(taskId));
        if (idx === -1) throw createError(404, 'Przypisanie tagu nie istnieje.');
        const task = db.tasks.find((t) => t.id === Number(taskId));
        const ev = db.evaluations.find((e) => e.id === task.ocena_id);
        assertCanEvaluate(currentUser, ev);
        db.taskTags.splice(idx, 1);
        saveDb(db);
        return { deleted: true, id: Number(taskTagId) };
    },

    async createHrEvent(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        assertCanEvaluate(currentUser, ev);

        const { typ_zdarzenia, data_od, data_do = null, dni_przesuniecia_terminu, opis = '' } = payload || {};
        if (!data_od) throw createError(400, 'Pole data_od jest wymagane.');

        let shiftDays = 0;
        if (dni_przesuniecia_terminu !== undefined && dni_przesuniecia_terminu !== null && dni_przesuniecia_terminu !== '') {
            shiftDays = Number(dni_przesuniecia_terminu);
        } else if (typ_zdarzenia === 'NIEOBECNOSC_POWYZEJ_MIESIACA' && data_do) {
            const duration = diffDaysIso(String(data_od), String(data_do));
            if (duration === null || duration < 0) {
                throw createError(400, 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
            }
            const inclusive = duration + 1;
            shiftDays = inclusive > 30 ? inclusive : 0;
        }

        const newEvent = {
            id: db.seq.hrEvents++,
            ocena_id: ev.id,
            typ_zdarzenia,
            data_od: String(data_od),
            data_do: data_do ? String(data_do) : null,
            dni_przesuniecia_terminu: shiftDays,
            opis: String(opis || '').trim() || null,
        };
        db.hrEvents.push(newEvent);
        ev.planowana_data_oceny = addDaysIso(ev.planowana_data_oceny, shiftDays);
        ev.updated_at = nowTs();
        saveDb(db);
        return { event: newEvent, planowana_data_oceny: ev.planowana_data_oceny };
    },

    async deleteHrEvent(eventId, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const idx = db.hrEvents.findIndex((x) => x.id === Number(eventId));
        if (idx === -1) throw createError(404, 'Zdarzenie kadrowe nie istnieje.');
        const eventRow = db.hrEvents[idx];
        const ev = db.evaluations.find((e) => e.id === eventRow.ocena_id);
        assertCanEvaluate(currentUser, ev);

        db.hrEvents.splice(idx, 1);
        ev.planowana_data_oceny = addDaysIso(ev.planowana_data_oceny, -eventRow.dni_przesuniecia_terminu);
        ev.updated_at = nowTs();
        saveDb(db);
        return { deleted: true, id: eventRow.id, planowana_data_oceny: ev.planowana_data_oceny };
    },

    async getAppeals(currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const appeals = db.appeals
            .map((ap) => {
                const ev = db.evaluations.find((e) => e.id === ap.ocena_id);
                const p = db.users.find((u) => u.id === ev.pracownik_id);
                const o = db.users.find((u) => u.id === ev.oceniajacy_id);
                return {
                    ...ap,
                    pracownik_id: ev.pracownik_id,
                    oceniajacy_id: ev.oceniajacy_id,
                    typ_arkusza: ev.typ_arkusza,
                    numer_podejscia: ev.numer_podejscia,
                    srednia_punktow: ev.srednia_punktow,
                    wynik_ogolny: ev.wynik_ogolny,
                    data_zapoznania_z_ocena: ev.data_zapoznania_z_ocena,
                    evaluation_status: ev.status,
                    pracownik_nazwa: p ? p.imie_nazwisko : '',
                    pracownik_stanowisko: p ? p.nazwa_stanowiska : '',
                    oceniajacy_nazwa: o ? o.imie_nazwisko : '',
                    decyzja_label: APPEAL_DECISION_LABELS[ap.decyzja_dyrektora] || ap.decyzja_dyrektora,
                    po_terminie_ustawowym: ev.data_zapoznania_z_ocena
                        ? diffDaysIso(ev.data_zapoznania_z_ocena, ap.data_zlozenia) > 7
                        : false,
                };
            })
            .filter((ap) => {
                if (currentUser.rola === 'OCENIANY') return ap.pracownik_id === currentUser.id;
                if (currentUser.rola === 'OCENIAJACY') {
                    return ap.oceniajacy_id === currentUser.id || ap.pracownik_id === currentUser.id;
                }
                return true;
            })
            .sort((a, b) => {
                const aPend = a.decyzja_dyrektora === 'OCZEKUJE' ? 0 : 1;
                const bPend = b.decyzja_dyrektora === 'OCZEKUJE' ? 0 : 1;
                return aPend !== bPend ? aPend - bPend : b.id - a.id;
            });

        return { appeals };
    },

    async createAppeal(evalId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const ev = db.evaluations.find((e) => e.id === Number(evalId));
        if (!ev) throw createError(404, 'Ocena okresowa nie istnieje.');
        if (currentUser.id !== ev.pracownik_id) {
            throw createError(403, 'Tylko oceniany pracownik może złożyć sprzeciw od własnej oceny.');
        }
        if (ev.status !== 'ZAKONCZONA') {
            throw createError(400, 'Sprzeciw można złożyć wyłącznie od zakończonej oceny.');
        }

        const reason = String((payload && payload.uzasadnienie_pracownika) || '').trim();
        if (!reason) throw createError(400, 'Wpisz uzasadnienie sprzeciwu przed wysłaniem.');
        if (db.appeals.some((ap) => ap.ocena_id === ev.id && ap.decyzja_dyrektora === 'OCZEKUJE')) {
            throw createError(409, 'Dla tej oceny istnieje już nierozpatrzony sprzeciw.');
        }

        const dataZlozenia = todayIso();
        const terminRozpatrzenia = addDaysIso(dataZlozenia, 14);
        const pastDeadline = ev.data_zapoznania_z_ocena
            ? diffDaysIso(ev.data_zapoznania_z_ocena, dataZlozenia) > 7
            : false;

        const appeal = {
            id: db.seq.appeals++,
            ocena_id: ev.id,
            data_zlozenia: dataZlozenia,
            uzasadnienie_pracownika: reason,
            termin_rozpatrzenia: terminRozpatrzenia,
            decyzja_dyrektora: 'OCZEKUJE',
            uzasadnienie_decyzji: null,
            data_decyzji: null,
        };
        db.appeals.push(appeal);
        ev.status = 'ODWOLANIE_W_TOKU';
        ev.updated_at = nowTs();
        saveDb(db);

        return {
            appeal: {
                ...appeal,
                decyzja_label: APPEAL_DECISION_LABELS.OCZEKUJE,
                po_terminie_ustawowym: pastDeadline,
            },
        };
    },

    async decideAppeal(appealId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        if (currentUser.rola !== 'DYREKTOR') {
            throw createError(403, 'Brak uprawnień do wykonania tej operacji (wymagana rola: DYREKTOR).');
        }

        const ap = db.appeals.find((a) => a.id === Number(appealId));
        if (!ap) throw createError(404, 'Sprzeciw nie istnieje.');
        if (ap.decyzja_dyrektora !== 'OCZEKUJE') throw createError(400, 'Ten sprzeciw został już rozpatrzony.');

        const { decyzja_dyrektora, uzasadnienie_decyzji = '' } = payload || {};

        if (
            !['ODRZUCONY', 'UWZGLEDNIONY_ZMIANA', 'UWZGLEDNIONY_PONOWNA_OCENA', 'NIEROZPATRZONY_W_TERMINIE'].includes(
                decyzja_dyrektora
            )
        ) {
            throw createError(400, 'Nieprawidłowa decyzja Dyrektora.');
        }

        const oldEval = db.evaluations.find((e) => e.id === ap.ocena_id);
        ap.decyzja_dyrektora = decyzja_dyrektora;
        ap.uzasadnienie_decyzji = String(uzasadnienie_decyzji || '').trim() || null;
        ap.data_decyzji = todayIso();

        let newEvaluation = null;
        if (decyzja_dyrektora === 'ODRZUCONY') {
            oldEval.status = 'ZAKONCZONA';
        } else if (decyzja_dyrektora === 'UWZGLEDNIONY_ZMIANA') {
            oldEval.status = 'PRZED_ROZMOWA_OCENIAJACA';
            oldEval.podpis_ocena_oceniajacy_at = null;
            oldEval.podpis_ocena_oceniany_at = null;
            oldEval.data_zapoznania_z_ocena = null;
        } else {
            oldEval.status = 'UNIEWAZNIONA';
            const oldCritIds = db.criteriaResults
                .filter((cr) => cr.ocena_id === oldEval.id)
                .map((cr) => cr.kryterium_id);
            const spawned = createActiveCycleInDb(db, {
                pracownikId: oldEval.pracownik_id,
                oceniajacyId: oldEval.oceniajacy_id,
                typArkusza: oldEval.typ_arkusza,
                startDate: oldEval.data_rozpoczecia_cyklu,
                isAfterNegative: oldEval.wynik_ogolny === 'NEGATYWNA',
                numerPodejscia: oldEval.numer_podejscia + 1,
                poprzedniaOcenaId: oldEval.id,
                status: 'PRZED_ROZMOWA_OCENIAJACA',
                criteriaIdsOverride: oldCritIds,
            });
            newEvaluation = hydrateEvaluation(db, spawned, { includePrivateTasks: true });
        }

        oldEval.updated_at = nowTs();
        saveDb(db);
        return {
            appeal: { ...ap, decyzja_label: APPEAL_DECISION_LABELS[decyzja_dyrektora] },
            evaluation: hydrateEvaluation(db, oldEval, { includePrivateTasks: true }),
            newEvaluation,
        };
    },

    async getRankRequests(currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        const rankRequests = db.rankRequests
            .map((rr) => {
                const ev = db.evaluations.find((e) => e.id === rr.ocena_id);
                const p = db.users.find((u) => u.id === ev.pracownik_id);
                const o = db.users.find((u) => u.id === ev.oceniajacy_id);
                return {
                    ...rr,
                    pracownik_id: ev.pracownik_id,
                    oceniajacy_id: ev.oceniajacy_id,
                    srednia_punktow: ev.srednia_punktow,
                    wynik_ogolny: ev.wynik_ogolny,
                    pracownik_nazwa: p ? p.imie_nazwisko : '',
                    obecny_stopien: p ? p.aktualny_stopien_sluzbowy : 0,
                    oceniajacy_nazwa: o ? o.imie_nazwisko : '',
                    status_label: RANK_STATUS_LABELS[rr.status_decyzji] || rr.status_decyzji,
                };
            })
            .filter((rr) => {
                if (currentUser.rola === 'OCENIANY') return rr.pracownik_id === currentUser.id;
                if (currentUser.rola === 'OCENIAJACY') {
                    return rr.oceniajacy_id === currentUser.id || rr.pracownik_id === currentUser.id;
                }
                return true;
            })
            .sort((a, b) => {
                const aPend = a.status_decyzji === 'OCZEKUJE' ? 0 : 1;
                const bPend = b.status_decyzji === 'OCZEKUJE' ? 0 : 1;
                return aPend !== bPend ? aPend - bPend : b.id - a.id;
            });

        return { rankRequests };
    },

    async decideRankRequest(reqId, payload, currentUserId) {
        const db = loadDb();
        const currentUser = getCurrentUserOrThrow(db, currentUserId);
        if (currentUser.rola !== 'DYREKTOR') {
            throw createError(403, 'Brak uprawnień do wykonania tej operacji (wymagana rola: DYREKTOR).');
        }
        const rr = db.rankRequests.find((r) => r.id === Number(reqId));
        if (!rr) throw createError(404, 'Wniosek o stopień służbowy nie istnieje.');
        if (rr.status_decyzji !== 'OCZEKUJE') throw createError(400, 'Ten wniosek został już rozpatrzony.');

        const { status_decyzji, motywacja_dyrektora = '' } = payload || {};
        if (!['ZATWIERDZONY', 'ODRZUCONY'].includes(status_decyzji)) {
            throw createError(400, 'Nieprawidłowa decyzja.');
        }

        const trimmedMotivation = String(motywacja_dyrektora || '').trim();
        if (status_decyzji === 'ODRZUCONY' && !trimmedMotivation) {
        throw createError(400, 'Uzasadnienie decyzji jest obowiązkowe przy odrzuceniu wniosku o stopień służbowy.');
        }

        rr.status_decyzji = status_decyzji;
        rr.motywacja_dyrektora = String(motywacja_dyrektora || '').trim() || null;
        rr.data_decyzji = todayIso();

        let newRank = null;
        if (status_decyzji === 'ZATWIERDZONY') {
            const ev = db.evaluations.find((e) => e.id === rr.ocena_id);
            const emp = db.users.find((u) => u.id === ev.pracownik_id);
            emp.aktualny_stopien_sluzbowy = rr.wnioskowany_stopien;
            newRank = emp.aktualny_stopien_sluzbowy;
        }

        saveDb(db);
        return {
            rankRequest: { ...rr, status_label: RANK_STATUS_LABELS[status_decyzji] },
            newRank,
        };
    },
};
