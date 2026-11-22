const express = require('express');
const path = require('path');
const { pool } = require('./db/pool');
const { initDatabase } = require('./db/init');
const { attachCurrentUser } = require('./middleware/demoAuth');
const { errorHandler } = require('./middleware/errorHandler');

const healthRouter = require('./routes/health');
const dictionariesRouter = require('./routes/dictionaries');
const legalConfigRouter = require('./routes/legalConfig');
const tagsRouter = require('./routes/tags');
const criteriaRouter = require('./routes/criteria');
const usersRouter = require('./routes/users');
const evaluationsRouter = require('./routes/evaluations');
const tasksRouter = require('./routes/tasks');
const hrEventsRouter = require('./routes/hrEvents');
const appealsRouter = require('./routes/appeals');
const rankRequestsRouter = require('./routes/rankRequests');

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(attachCurrentUser);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', healthRouter);
app.use('/api', dictionariesRouter);
app.use('/api', legalConfigRouter);
app.use('/api', tagsRouter);
app.use('/api', criteriaRouter);
app.use('/api', usersRouter);
app.use('/api', evaluationsRouter);
app.use('/api', tasksRouter);
app.use('/api', hrEventsRouter);
app.use('/api', appealsRouter);
app.use('/api', rankRequestsRouter);

app.use('/api', (req, res) => {
    res.status(404).json({ error: `Nie znaleziono endpointu: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

initDatabase()
    .then(() => {
        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`Node.js listening on port ${port}`);
        });

        const shutdown = (signal) => {
            console.log(`Received ${signal}, shutting down gracefully...`);
            server.close(async () => {
                try {
                    await pool.end();
                } catch (err) {
                    console.error('Error closing PostgreSQL pool:', err);
                }
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
