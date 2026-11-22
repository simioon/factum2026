const test = require('node:test');
const assert = require('node:assert/strict');

test('Central date formatter supports DD.MM.YYYY default and custom formats', async () => {
    const { DATE_FORMAT, formatDate, formatDateTime, formatDatesInText } = await import(
        '../public/js/utils.js'
    );

    assert.equal(DATE_FORMAT, 'DD.MM.YYYY');
    assert.equal(formatDate('2026-11-22'), '22.11.2026');
    assert.equal(formatDate('2026-11-22T01:20:00.000Z'), '22.11.2026');
    assert.equal(formatDate(null), '—');
    assert.equal(formatDate(''), '—');

    assert.equal(formatDate('2026-11-22', 'DD/MM/YYYY'), '22/11/2026');
    assert.equal(formatDate('2026-11-22', 'DD-MM-YYYY'), '22-11-2026');
    assert.equal(formatDate('2026-11-22', 'YYYY-MM-DD'), '2026-11-22');
    assert.equal(formatDate('2026-11-22', 'LONG_PL'), '22 listopada 2026');

    assert.equal(formatDateTime('2024-12-18 10:15:00'), '18.12.2024 10:15');
    assert.equal(formatDateTime('2024-12-18'), '18.12.2024');
    assert.equal(formatDateTime(null), '—');

    assert.equal(
        formatDatesInText('Wymagana rozmowa wstępna w ciągu 7 dni (do 2026-11-23).'),
        'Wymagana rozmowa wstępna w ciągu 7 dni (do 23.11.2026).'
    );
});
