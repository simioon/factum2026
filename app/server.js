const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    `);

    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM items;');
    if (rows[0].count === 0) {
        await pool.query(`
        INSERT INTO items (name, category) VALUES
        ('Arch Wiki Guide', 'Documentation'),
                         ('Docker Compose Setup', 'DevOps'),
                         ('Nginx Reverse Proxy', 'Networking'),
                         ('Express API Server', 'Backend'),
                         ('PostgreSQL 19 Cluster', 'Database'),
                         ('Fish Shell Config', 'Terminal'),
                         ('Systemd Service Unit', 'Linux'),
                         ('Git Repository Sync', 'Version Control');
                         `);
        console.log('Seeded 8 sample rows into items table.');
    }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS server_time, version() AS pg_version;');
        res.json({
            status: 'connected',
            server_time: result.rows[0].server_time,
            pg_version: result.rows[0].pg_version,
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

app.get('/api/items', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, category, created_at FROM items ORDER BY id ASC LIMIT 5;'
        );
        res.json({ rows: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

initDatabase()
.then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Node.js listening on port ${port}`);
    });
})
.catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
