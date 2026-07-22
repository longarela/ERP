const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const poService = require('../services/purchaseOrderService');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT po.*, s.name AS supplier_name, u.full_name AS user_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN users u ON u.id = po.user_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND po.status = ?'; params.push(status); }
  query += ' ORDER BY po.created_at DESC';
  res.json(db.prepare(query).all(...params));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(poService.getFullPO(req.params.id));
}));

router.post('/', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.supplierId) throw new ApiError(400, 'El proveedor es requerido');
  const po = poService.createPurchaseOrder({
    supplierId: b.supplierId,
    expectedDate: b.expectedDate || null,
    notes: b.notes || null,
    items: b.items,
    userId: req.user.id,
  });
  logAction(req, 'create_purchase_order', 'purchase_order', po.id, { supplierId: b.supplierId, items: b.items.length });
  res.status(201).json(po);
}));

router.post('/:id/receive', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const po = poService.receivePurchaseOrder({
    poId: req.params.id,
    receivedItems: req.body.items,
    userId: req.user.id,
    warehouseId: req.body.warehouseId || null,
  });
  logAction(req, 'receive_purchase_order', 'purchase_order', req.params.id, req.body);
  res.json(po);
}));

module.exports = router;
