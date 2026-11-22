const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const { seedIfEmpty } = require('./seed');

async function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    await seedIfEmpty();
}

module.exports = {
    initDatabase,
};
