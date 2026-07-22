const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const salesService = require('../services/salesService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { from, to, userId, customerId, status } = req.query;
  let query = `
    SELECT sa.*, c.name AS customer_name, u.full_name AS user_name
    FROM sales sa
    LEFT JOIN customers c ON c.id = sa.customer_id
    LEFT JOIN users u ON u.id = sa.user_id
    WHERE 1=1
  `;
  const params = [];
  if (from) { query += ' AND date(sa.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(sa.created_at) <= date(?)'; params.push(to); }
  if (userId) { query += ' AND sa.user_id = ?'; params.push(userId); }
  if (customerId) { query += ' AND sa.customer_id = ?'; params.push(customerId); }
  if (status) { query += ' AND sa.status = ?'; params.push(status); }
  query += ' ORDER BY sa.created_at DESC, sa.id DESC LIMIT 500';
  res.json(db.prepare(query).all(...params));
}));

router.get('/today-summary', asyncHandler(async (req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS total_amount
    FROM sales WHERE date(created_at) = date('now') AND status = 'completada'
  `).get();
  res.json(row);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(salesService.getFullSale(req.params.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.paymentMethod) throw new ApiError(400, 'El método de pago es requerido');
  const sale = salesService.createSale({
    items: b.items,
    customerId: b.customerId || null,
    paymentMethod: b.paymentMethod,
    amountPaid: b.amountPaid,
    discountTotal: b.discountTotal || 0,
    userId: req.user.id,
  });
  logAction(req, 'create_sale', 'sale', sale.id, { total: sale.total, items: b.items.length });
  res.status(201).json(sale);
}));

router.post('/:id/void', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const sale = salesService.voidSale({ saleId: req.params.id, userId: req.user.id, reason: req.body.reason });
  logAction(req, 'void_sale', 'sale', req.params.id, req.body);
  res.json(sale);
}));

module.exports = router;
