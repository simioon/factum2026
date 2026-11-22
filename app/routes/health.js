const express = require('express');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get(
    '/health',
    asyncHandler(async (req, res) => {
        const result = await query('SELECT NOW() AS server_time;');
        res.json({
            status: 'ok',
            db: 'connected',
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

module.exports = router;
