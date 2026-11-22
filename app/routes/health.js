const express = require('express');
const { query } = require('../db/pool');
const { resetDatabase } = require('../db/reset');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function isDemoModeEnabled() {
    return String(process.env.SEED_DEMO_DATA || 'true').toLowerCase() !== 'false';
}

router.get(
    '/health',
    asyncHandler(async (req, res) => {
        const result = await query('SELECT NOW() AS server_time;');
        res.json({
            status: 'ok',
            db: 'connected',
            demoMode: isDemoModeEnabled(),
            server_time: result.rows[0].server_time,
        });
    })
);

router.get(
    '/test-db',
    asyncHandler(async (req, res) => {
        const result = await query('SELECT NOW() AS server_time, version() AS pg_version;');
        res.json({
            status: 'connected',
            server_time: result.rows[0].server_time,
            pg_version: result.rows[0].pg_version,
        });
    })
);

router.post(
    '/demo/reset',
    asyncHandler(async (req, res) => {
        if (!isDemoModeEnabled()) {
            throw new HttpError(403, 'Reset danych demonstracyjnych jest wyłączony w trybie produkcyjnym (SEED_DEMO_DATA=false).');
        }
        await resetDatabase();
        res.json({ reset: true });
    })
);

module.exports = router;
