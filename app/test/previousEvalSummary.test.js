const test = require('node:test');
const assert = require('node:assert/strict');

test('Previous evaluation cheat sheet summary & renderer', async (t) => {
    const {
        buildPreviousEvaluationSummary,
        renderPreviousEvaluationCheatSheetHtml,
    } = await import('../public/js/utils.js');

    await t.test('1. Empty history returns single first-evaluation line', () => {
        const summary = buildPreviousEvaluationSummary([]);
        assert.equal(summary.hasHistory, false);
        assert.equal(summary.emptyMessage, 'Pierwsza ocena w systemie — brak wcześniejszej historii.');

        const html = renderPreviousEvaluationCheatSheetHtml([]);
        assert.ok(html.includes('is-empty'));
        assert.ok(html.includes('Pierwsza ocena w systemie — brak wcześniejszej historii.'));
    });

    await t.test('2. Ignores UNIEWAZNIONA and ODWOLANIE_W_TOKU when no ZAKONCZONA exists', () => {
        const past = [
            { id: 10, status: 'UNIEWAZNIONA', wynik_ogolny: 'NEGATYWNA', srednia_punktow: 2.6, criteria: [] },
            { id: 11, status: 'ODWOLANIE_W_TOKU', wynik_ogolny: 'NEGATYWNA', srednia_punktow: 3.0, criteria: [] },
        ];
        const summary = buildPreviousEvaluationSummary(past);
        assert.equal(summary.hasHistory, false);
    });

    await t.test('3. NEGATYWNA with 1 pkt and 3 pkt shows Obszary poniżej oczekiwań sorted ascending', () => {
        const past = [
            {
                id: 2,
                status: 'ZAKONCZONA',
                wynik_ogolny: 'NEGATYWNA',
                srednia_punktow: '2.60',
                data_zapoznania_z_ocena: '2026-11-15',
                wnioski_iprz: 'Szkolenie z zarządzania czasem i wdrożenie tygodniowych przeglądów zadań.',
                criteria: [
                    { nazwa: 'Komunikacja', punkty: 5, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Organizacja pracy', punkty: 3, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Rzetelność', punkty: 1, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Współpraca', punkty: 5, typ_kryterium: 'OBOWIAZKOWE' },
                ],
            },
        ];

        const summary = buildPreviousEvaluationSummary(past);
        assert.equal(summary.hasHistory, true);
        assert.equal(summary.result, 'NEGATYWNA');
        assert.equal(summary.averageText, '2.6');
        assert.equal(summary.dateText, '15.11.2026');
        assert.equal(summary.focusMode, 'below_expectations');
        assert.equal(summary.focusLabel, 'Obszary poniżej oczekiwań');
        assert.deepEqual(summary.focusItems, [
            { nazwa: 'Rzetelność', punkty: 1 },
            { nazwa: 'Organizacja pracy', punkty: 3 },
        ]);

        const html = renderPreviousEvaluationCheatSheetHtml(past);
        assert.ok(html.includes('is-negative'));
        assert.ok(html.includes('NEGATYWNA (2.6 pkt)'));
        assert.ok(html.includes('15.11.2026'));
        assert.ok(html.includes('Obszary poniżej oczekiwań:'));
        assert.ok(html.includes('Rzetelność (1 pkt), Organizacja pracy (3 pkt)'));
        assert.ok(html.includes('Szkolenie z zarządzania czasem'));
    });

    await t.test('4. High scores with DODATKOWE criteria prefers Poprzednie kryteria dodatkowe', () => {
        const past = [
            {
                id: 3,
                status: 'ZAKONCZONA',
                wynik_ogolny: 'POZYTYWNA',
                srednia_punktow: 7.2,
                data_rozmowy_oceniajacej: '2025-05-10',
                wnioski_iprz: 'Mentoring nowych pracowników.',
                criteria: [
                    { nazwa: 'Komunikacja', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Rzetelność', punkty: 9, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Myślenie analityczne', punkty: 7, typ_kryterium: 'DODATKOWE' },
                    { nazwa: 'Kreatywność', punkty: 5, typ_kryterium: 'DODATKOWE' },
                ],
            },
        ];

        const summary = buildPreviousEvaluationSummary(past);
        assert.equal(summary.focusMode, 'previous_additional');
        assert.equal(summary.focusLabel, 'Poprzednie kryteria dodatkowe');
        assert.deepEqual(summary.focusItems, [
            { nazwa: 'Myślenie analityczne', punkty: 7 },
            { nazwa: 'Kreatywność', punkty: 5 },
        ]);
        assert.equal(summary.overflowCount, 0);
    });

    await t.test('5. High scores with only mandatory criteria falls back to Najniżej ocenione kryteria capped at 3 + (+N)', () => {
        const past = [
            {
                id: 1,
                status: 'ZAKONCZONA',
                wynik_ogolny: 'POZYTYWNA',
                srednia_punktow: 7.4,
                data_zapoznania_z_ocena: '2024-11-28',
                wnioski_iprz: '',
                criteria: [
                    { nazwa: 'Komunikacja', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Organizacja pracy', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Rzetelność', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Wykorzystywanie wiedzy', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                    { nazwa: 'Współpraca', punkty: 9, typ_kryterium: 'OBOWIAZKOWE' },
                ],
            },
        ];

        const summary = buildPreviousEvaluationSummary(past);
        assert.equal(summary.focusMode, 'lowest_criteria');
        assert.equal(summary.focusLabel, 'Najniżej ocenione kryteria');
        assert.equal(summary.focusItems.length, 3);
        assert.equal(summary.overflowCount, 1);
        assert.equal(summary.iprz, null);

        const html = renderPreviousEvaluationCheatSheetHtml(past);
        assert.ok(html.includes('is-positive'));
        assert.ok(html.includes('(+1)'));
        assert.ok(html.includes('Brak zapisanych wniosków.'));
    });

    await t.test('6. Escapes HTML special characters in criterion name and IPRZ text', () => {
        const past = [
            {
                id: 99,
                status: 'ZAKONCZONA',
                wynik_ogolny: 'POZYTYWNA',
                srednia_punktow: 7,
                data_zapoznania_z_ocena: '2026-01-10',
                wnioski_iprz: '<script>alert(1)</script>',
                criteria: [{ nazwa: '<b>Test</b>', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' }],
            },
        ];

        const html = renderPreviousEvaluationCheatSheetHtml(past);
        assert.equal(html.includes('<script>'), false);
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
        assert.ok(html.includes('Najniżej ocenione kryterium:'));
        assert.ok(html.includes('&lt;b&gt;Test&lt;/b&gt; (7 pkt)'));
    });
});
