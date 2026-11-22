const test = require('node:test');
const assert = require('node:assert/strict');
const {
    addDaysIso,
    addMonthsIso,
    diffDaysIso,
    calculateFinalResult,
    computeCriterionTagSuggestion,
    checkAutoRankPromotion,
    computeEmployeeAlerts,
    slugifyEmail,
} = require('../domain/legalRules');

test('calculateFinalResult: handles all 5 rating levels and § 11 thresholds', () => {
    assert.deepEqual(calculateFinalResult([1, 1, 1, 1, 1]), {
        srednia_punktow: 1,
        poziom_oceny: 'ZNACZNIE_PONIZEJ_OCZEKIWAN',
        poziom_oceny_label: 'Znacznie poniżej oczekiwań',
        wynik_ogolny: 'NEGATYWNA',
        hasOnePoint: true,
    });

    const lvl2 = calculateFinalResult([3, 3, 5, 3, 5]); // 3.8
    assert.equal(lvl2.srednia_punktow, 3.8);
    assert.equal(lvl2.poziom_oceny, 'PONIZEJ_OCZEKIWAN');
    assert.equal(lvl2.wynik_ogolny, 'NEGATYWNA');

    const lvl3 = calculateFinalResult([5, 5, 5, 5, 5]); // 5.0
    assert.equal(lvl3.poziom_oceny, 'NA_POZIOMIE_OCZEKIWAN');
    assert.equal(lvl3.wynik_ogolny, 'POZYTYWNA');

    const lvl4 = calculateFinalResult([7, 7, 7, 9, 7]); // 7.4
    assert.equal(lvl4.srednia_punktow, 7.4);
    assert.equal(lvl4.poziom_oceny, 'POWYZEJ_OCZEKIWAN');
    assert.equal(lvl4.wynik_ogolny, 'POZYTYWNA');

    const lvl5 = calculateFinalResult([9, 9, 9, 9, 7]); // 8.6
    assert.equal(lvl5.srednia_punktow, 8.6);
    assert.equal(lvl5.poziom_oceny, 'ZNACZNIE_POWYZEJ_OCZEKIWAN');
    assert.equal(lvl5.wynik_ogolny, 'POZYTYWNA');
});

test('calculateFinalResult: any 1-point criterion forces NEGATYWNA even if average > 4', () => {
    const res = calculateFinalResult([9, 9, 9, 9, 1]); // avg 7.4
    assert.equal(res.srednia_punktow, 7.4);
    assert.equal(res.poziom_oceny, 'POWYZEJ_OCZEKIWAN');
    assert.equal(res.hasOnePoint, true);
    assert.equal(res.wynik_ogolny, 'NEGATYWNA');
});

test('calculateFinalResult: rejects scores outside {1, 3, 5, 7, 9}', () => {
    assert.throws(() => calculateFinalResult([5, 4, 5]), /Nieprawidłowa punktacja/);
});

test('checkAutoRankPromotion: enforces rank 1..8, >6.0 average, and two consecutive positive evals', () => {
    const posHigh = { wynik_ogolny: 'POZYTYWNA', srednia_punktow: 6.2 };
    const posExactSix = { wynik_ogolny: 'POZYTYWNA', srednia_punktow: 6.0 };
    const negEval = { wynik_ogolny: 'NEGATYWNA', srednia_punktow: 3.4 };

    assert.equal(checkAutoRankPromotion(0, posHigh, posHigh), false); // contract worker
    assert.equal(checkAutoRankPromotion(9, posHigh, posHigh), false); // max rank 9
    assert.equal(checkAutoRankPromotion(2, posExactSix, posHigh), false); // not > 6
    assert.equal(checkAutoRankPromotion(2, posHigh, posExactSix), false); // prev not > 6
    assert.equal(checkAutoRankPromotion(2, posHigh, negEval), false); // prev negative
    assert.equal(checkAutoRankPromotion(2, posHigh, null), false); // no prev eval
    assert.equal(checkAutoRankPromotion(2, posHigh, posHigh), true); // eligible!
});

test('UTC ISO date arithmetic: leap years, month ends, and day diffs without timezone drift', () => {
    assert.equal(addDaysIso('2026-11-16', 7), '2026-11-23');
    assert.equal(addDaysIso('2024-02-28', 1), '2024-02-29'); // leap year
    assert.equal(addMonthsIso('2024-02-29', 24), '2026-02-28'); // clamp Feb 29 -> Feb 28
    assert.equal(addMonthsIso('2026-11-16', 6), '2027-05-16');
    assert.equal(diffDaysIso('2026-11-16', '2026-11-23'), 7);
    assert.equal(diffDaysIso('2026-01-01', '2026-02-14'), 44);
});

test('computeCriterionTagSuggestion: mirrors tag polarity balance heuristics', () => {
    assert.equal(computeCriterionTagSuggestion(0, 0).suggestedScore, 5);
    assert.equal(computeCriterionTagSuggestion(3, 0).suggestedScore, 9);
    assert.equal(computeCriterionTagSuggestion(2, 1).suggestedScore, 7);
    assert.equal(computeCriterionTagSuggestion(1, 1).suggestedScore, 5);
    assert.equal(computeCriterionTagSuggestion(0, 2).suggestedScore, 3);
    assert.equal(computeCriterionTagSuggestion(0, 3).suggestedScore, 1);
});

test('computeEmployeeAlerts: detects missing interview, wellbeing overload, and appreciation', () => {
    const overloadAlerts = computeEmployeeAlerts({
        activeEval: {
            status: 'WYZNACZANIE_KRYTERIOW',
            data_rozmowy_wstepnej: null,
            termin_wyznaczenia_kryteriow: '2026-11-23',
            planowana_data_oceny: '2027-05-16',
        },
        tasks: [
            {
                tags: [
                    { kategoria: 'DOBROSTAN', polaryzacja: '-' },
                    { kategoria: 'KOMPETENCYJNY', polaryzacja: '-' },
                ],
            },
        ],
        previousEval: { wynik_ogolny: 'NEGATYWNA' },
        today: '2026-11-22',
    });

    assert.ok(overloadAlerts.some((a) => a.code === 'MISSING_INITIAL_INTERVIEW' && a.message.includes('7 dni')));
    assert.ok(overloadAlerts.some((a) => a.code === 'HR_PARTNER_OVERLOAD'));

    const positiveAlerts = computeEmployeeAlerts({
        activeEval: {
            status: 'W_TRAKCIE_OKRESU',
            data_rozmowy_wstepnej: '2024-12-18',
            termin_wyznaczenia_kryteriow: '2024-12-31',
            planowana_data_oceny: '2026-12-01',
        },
        tasks: [
            {
                tags: Array.from({ length: 5 }, () => ({ kategoria: 'KOMPETENCYJNY', polaryzacja: '+' })),
            },
        ],
        previousEval: null,
        today: '2026-11-22',
    });

    assert.ok(positiveAlerts.some((a) => a.code === 'HR_PARTNER_APPRECIATION'));
    assert.ok(positiveAlerts.some((a) => a.code === 'APPROACHING_EVALUATION_DEADLINE'));
});

test('slugifyEmail: transliterates Polish diacritics cleanly', () => {
    assert.equal(slugifyEmail('Żółć Śćźńłóęą'), 'zolc.scznloea@urzad.gov.pl');
});
