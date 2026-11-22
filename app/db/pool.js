const { Pool, types } = require('pg');

// Keep PostgreSQL DATE (OID 1082) as 'YYYY-MM-DD' strings to avoid timezone shifts.
types.setTypeParser(1082, (val) => val);
// Parse PostgreSQL NUMERIC (OID 1700) to JS Number.
types.setTypeParser(1700, (val) => (val === null ? null : Number(val)));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

function query(text, params = []) {
    return pool.query(text, params);
}

async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query,
    withTransaction,
};
