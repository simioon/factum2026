const test = require('node:test');
const assert = require('node:assert/strict');

test('printSheet buildCriteriaPartitions respects dynamic Admin criteria & legalConfig', async (t) => {
    const { state } = await import('../public/js/state.js');
    const { buildCriteriaPartitions } = await import('../public/js/views/printSheet.js');

    state.dictionaries = {
        criteria: [
            { id: 1, nazwa: 'Komunikacja urzędowa (zmieniona)' },
            { id: 8, nazwa: 'Rzetelność' },
            { id: 15, nazwa: 'Cyberbezpieczeństwo i RODO' },
            { id: 2, nazwa: 'Kreatywność' },
            { id: 3, nazwa: 'Negocjowanie' },
            { id: 5, nazwa: 'Orientacja na klienta' },
            { id: 7, nazwa: 'Kryzysy' },
        ],
        sheetCriteria: {
            C: { mandatoryIds: [1, 8, 15], additionalIds: [2, 3, 5, 7] },
        },
        legalConfig: { maxAdditionalCriteria: 4, appealDaysLimit: 10 },
    };

    await t.test('Renamed and newly added mandatory criteria stay in mandatoryRows', () => {
        const evaluation = {
            typ_arkusza: 'C',
            criteria: [
                { kryterium_id: 1, nazwa: 'Komunikacja urzędowa (zmieniona)', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                { kryterium_id: 8, nazwa: 'Rzetelność', punkty: 9, typ_kryterium: 'OBOWIAZKOWE' },
                { kryterium_id: 15, nazwa: 'Cyberbezpieczeństwo i RODO', punkty: 7, typ_kryterium: 'OBOWIAZKOWE' },
                { kryterium_id: 2, nazwa: 'Kreatywność', punkty: 5, typ_kryterium: 'DODATKOWE' },
            ],
        };

        const { mandatoryRows, additionalRows } = buildCriteriaPartitions(evaluation);
        assert.deepEqual(
            mandatoryRows.map((r) => [r.nazwa, r.punkty]),
            [
                ['Komunikacja urzędowa (zmieniona)', 7],
                ['Rzetelność', 9],
                ['Cyberbezpieczeństwo i RODO', 7],
            ]
        );
        assert.equal(additionalRows.length, 4); // respects legalConfig.maxAdditionalCriteria = 4
        assert.equal(additionalRows[0].nazwa, 'Kreatywność');
        assert.equal(additionalRows[0].punkty, 5);
        assert.equal(additionalRows[1].nazwa, '');
    });

    await t.test('Legacy criteria without typ_kryterium partition via dictionaries.sheetCriteria', () => {
        const evaluation = {
            typ_arkusza: 'C',
            criteria: [
                { kryterium_id: 1, nazwa: 'Komunikacja urzędowa (zmieniona)', punkty: 7 },
                { kryterium_id: 15, nazwa: 'Cyberbezpieczeństwo i RODO', punkty: 9 },
                { kryterium_id: 3, nazwa: 'Negocjowanie', punkty: 5 },
            ],
        };

        const { mandatoryRows, additionalRows } = buildCriteriaPartitions(evaluation);
        assert.equal(mandatoryRows.length, 2);
        assert.equal(mandatoryRows[1].nazwa, 'Cyberbezpieczeństwo i RODO');
        assert.equal(additionalRows[0].nazwa, 'Negocjowanie');
    });

    state.dictionaries = null;
});
