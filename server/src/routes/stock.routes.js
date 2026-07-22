const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const stockService = require('../services/stockService');

const router = express.Router();
router.use(requireAuth);

router.get('/movements', asyncHandler(async (req, res) => {
  const { productId, type, from, to } = req.query;
  let query = `
    SELECT m.*, p.name AS product_name, p.code AS product_code, u.full_name AS user_name
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE 1=1
  `;
  const params = [];
  if (productId) { query += ' AND m.product_id = ?'; params.push(productId); }
  if (type) { query += ' AND m.type = ?'; params.push(type); }
  if (from) { query += ' AND date(m.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(m.created_at) <= date(?)'; params.push(to); }
  query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 500';
  res.json(db.prepare(query).all(...params));
}));

router.post('/entry', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const b = req.body;
  const product = stockService.addEntry({
    productId: b.productId,
    quantity: Number(b.quantity),
    unitCost: b.unitCost != null ? Number(b.unitCost) : undefined,
    reason: b.reason,
    referenceType: 'manual_entry',
    referenceId: null,
    userId: req.user.id,
    expiryDate: b.expiryDate || null,
    batchCode: b.batchCode || null,
    warehouseId: b.warehouseId || null,
    type: b.type || 'compra',
  });
  logAction(req, 'stock_entry', 'product', b.productId, b);
  res.status(201).json(product);
}));

router.post('/adjustment', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const b = req.body;
  const product = stockService.adjustStock({
    productId: b.productId,
    quantity: Number(b.quantity),
    reason: b.reason,
    userId: req.user.id,
    warehouseId: b.warehouseId || null,
  });
  logAction(req, 'stock_adjustment', 'product', b.productId, b);
  res.status(201).json(product);
}));

router.post('/loss', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const b = req.body;
  const product = stockService.registerLoss({
    productId: b.productId,
    quantity: Number(b.quantity),
    reason: b.reason,
    userId: req.user.id,
    warehouseId: b.warehouseId || null,
  });
  logAction(req, 'stock_loss', 'product', b.productId, b);
  res.status(201).json(product);
}));

module.exports = router;
