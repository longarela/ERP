const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const reorderService = require('../services/reorderService');

const router = express.Router();
router.use(requireAuth);

router.get('/suggestions', asyncHandler(async (req, res) => {
  const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 30;
  const onlyNeeded = req.query.all !== 'true';
  res.json(reorderService.getAllSuggestions(windowDays, { onlyNeeded }));
}));

router.get('/product/:id', asyncHandler(async (req, res) => {
  const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 30;
  res.json(reorderService.analyzeProduct(req.params.id, windowDays));
}));

router.post('/snapshot', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const windowDays = req.body.windowDays || 30;
  const suggestions = reorderService.persistSuggestions(windowDays);
  logAction(req, 'reorder_snapshot', 'system', null, { count: suggestions.length, windowDays });
  res.status(201).json(suggestions);
}));

router.get('/history', asyncHandler(async (req, res) => {
  res.json(db.prepare(`
    SELECT rs.*, p.name AS product_name, p.code AS product_code
    FROM reorder_suggestions rs JOIN products p ON p.id = rs.product_id
    ORDER BY rs.created_at DESC LIMIT 300
  `).all());
}));

module.exports = router;
