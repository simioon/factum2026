const { pool } = require('./pool');
const { initDatabase } = require('./init');
const { resetLegalConfig } = require('../domain/legalRules');

async function resetDatabase() {
    resetLegalConfig();
    await pool.query(`
        TRUNCATE TABLE
            wnioski_stopien_sluzbowy,
            sprzeciwy_odwolania,
            zdarzenia_kadrowe,
            zadanie_tagi,
            zadania_obserwacje,
            tag_kryteria,
            slownik_tagow,
            ocena_kryteria_wyniki,
            oceny_okresowe,
            arkusz_kryteria,
            slownik_kryteriow,
            uzytkownicy
        RESTART IDENTITY CASCADE;
    `);
    await initDatabase();
    console.log('Database reset and re-seeded successfully.');
}

if (require.main === module) {
    resetDatabase()
        .then(() => pool.end())
        .catch(async (err) => {
            console.error('Database reset failed:', err);
            await pool.end();
            process.exit(1);
        });
}

module.exports = {
    resetDatabase,
};
