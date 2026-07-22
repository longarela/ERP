const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const expiryService = require('../services/expiryService');
const stockService = require('../services/stockService');

const router = express.Router();
router.use(requireAuth);

router.get('/near-expiry', asyncHandler(async (req, res) => {
  const maxDays = req.query.days ? Number(req.query.days) : undefined;
  res.json(expiryService.getNearExpiry(maxDays));
}));

router.get('/expired', asyncHandler(async (req, res) => {
  res.json(expiryService.getExpired());
}));

router.get('/discarded', asyncHandler(async (req, res) => {
  res.json(expiryService.getDiscardHistory());
}));

router.post('/:id/discard', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const batch = stockService.discardBatch({
    batchId: req.params.id,
    userId: req.user.id,
    reason: req.body.reason || 'Producto vencido',
  });
  logAction(req, 'discard_batch', 'product_batch', req.params.id, req.body);
  res.json(batch);
}));

module.exports = router;
