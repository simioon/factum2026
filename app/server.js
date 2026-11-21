const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS server_time');
        res.json({
            status: 'ok',
            message: 'Nginx -> Node.js -> PostgreSQL works!',
            db_time: result.rows[0].server_time,
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Node.js listening on port ${port}`);
});
