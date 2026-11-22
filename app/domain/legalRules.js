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

const ALLOWED_SCORES = new Set([1, 3, 5, 7, 9]);

function parseIsoDateUtc(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (
        dt.getUTCFullYear() !== year ||
        dt.getUTCMonth() !== month - 1 ||
        dt.getUTCDate() !== day
    ) {
        return null;
    }
    return dt;
}

function formatUtcIsoDate(dt) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function todayIso() {
    return formatUtcIsoDate(new Date());
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
    const lastDayOfTargetMonth = new Date(
        Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)
    ).getUTCDate();
    dt.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
    return formatUtcIsoDate(dt);
}

function diffDaysIso(startStr, endStr) {
    const start = parseIsoDateUtc(startStr);
    const end = parseIsoDateUtc(endStr);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function calculateFinalResult(scoresInput) {
    const rawValues = Array.isArray(scoresInput)
        ? scoresInput
        : Object.values(scoresInput || {});

    if (rawValues.length === 0) {
        return {
            srednia_punktow: 0,
            poziom_oceny: 'ZNACZNIE_PONIZEJ_OCZEKIWAN',
            poziom_oceny_label: LEVEL_LABELS.ZNACZNIE_PONIZEJ_OCZEKIWAN,
            wynik_ogolny: 'NEGATYWNA',
            hasOnePoint: false,
        };
    }

    let sum = 0;
    let hasOnePoint = false;
    for (const raw of rawValues) {
        const val = Number(raw);
        if (!ALLOWED_SCORES.has(val)) {
            throw new Error(`Nieprawidłowa punktacja kryterium: ${raw}. Dozwolone wartości: 1, 3, 5, 7, 9.`);
        }
        sum += val;
        if (val === 1) hasOnePoint = true;
    }

    const avg = Number((sum / rawValues.length).toFixed(2));
    let poziomOceny;
    if (avg <= 2) poziomOceny = 'ZNACZNIE_PONIZEJ_OCZEKIWAN';
    else if (avg <= 4) poziomOceny = 'PONIZEJ_OCZEKIWAN';
    else if (avg <= 6) poziomOceny = 'NA_POZIOMIE_OCZEKIWAN';
    else if (avg <= 8) poziomOceny = 'POWYZEJ_OCZEKIWAN';
    else poziomOceny = 'ZNACZNIE_POWYZEJ_OCZEKIWAN';

    const wynikOgolny = avg > 4 && !hasOnePoint ? 'POZYTYWNA' : 'NEGATYWNA';

    return {
        srednia_punktow: avg,
        poziom_oceny: poziomOceny,
        poziom_oceny_label: LEVEL_LABELS[poziomOceny],
        wynik_ogolny: wynikOgolny,
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
    const limitDays = isAfterNeg
        ? LEGAL_CONFIG.initialInterviewDaysAfterNegative
        : LEGAL_CONFIG.initialInterviewDaysNormal;

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

module.exports = {
    LEGAL_CONFIG,
    SCORE_SCALE,
    LEVEL_LABELS,
    STATUS_LABELS,
    APPEAL_DECISION_LABELS,
    RANK_STATUS_LABELS,
    EVENT_TYPE_LABELS,
    IPRZ_SUGGESTIONS_BY_CRITERION,
    ALLOWED_SCORES,
    parseIsoDateUtc,
    todayIso,
    addDaysIso,
    addMonthsIso,
    diffDaysIso,
    calculateFinalResult,
    computeCriterionTagSuggestion,
    checkAutoRankPromotion,
    computeEmployeeAlerts,
    slugifyEmail,
};
