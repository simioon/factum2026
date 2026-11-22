class HttpError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof HttpError) {
        const body = { error: err.message };
        if (err.details) body.details = err.details;
        return res.status(err.status).json(body);
    }

    if (err && err.code) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Konflikt unikalności danych (rekord już istnieje).' });
        }
        if (err.code === '23503' || err.code === '23514' || err.code === '22P02' || err.code === '23502') {
            return res.status(400).json({ error: `Nieprawidłowe dane wejściowe: ${err.message}` });
        }
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
}

module.exports = {
    HttpError,
    asyncHandler,
    errorHandler,
};
