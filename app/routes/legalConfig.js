const express = require('express');
const { requireRole } = require('../middleware/demoAuth');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const {
    DEFAULT_LEGAL_CONFIG,
    LEGAL_CONFIG_BOUNDS,
    getLegalConfig,
    updateLegalConfig,
    resetLegalConfig,
} = require('../domain/legalRules');

const router = express.Router();

router.get(
    '/legal-config',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        res.json({
            legalConfig: getLegalConfig(),
            defaults: { ...DEFAULT_LEGAL_CONFIG },
            bounds: LEGAL_CONFIG_BOUNDS,
        });
    })
);

router.put(
    '/legal-config',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        let updated;
        try {
            updated = updateLegalConfig(req.body || {});
        } catch (err) {
            throw new HttpError(400, err.message);
        }

        res.json({
            legalConfig: updated,
            defaults: { ...DEFAULT_LEGAL_CONFIG },
        });
    })
);

router.post(
    '/legal-config/reset',
    requireRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const restored = resetLegalConfig();
        res.json({
            reset: true,
            legalConfig: restored,
            defaults: { ...DEFAULT_LEGAL_CONFIG },
        });
    })
);

module.exports = router;
