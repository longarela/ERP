const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth);

const listStmt = db.prepare('SELECT * FROM customers WHERE active = 1 ORDER BY name');
const getStmt = db.prepare('SELECT * FROM customers WHERE id = ?');
const insertStmt = db.prepare(`
  INSERT INTO customers (name, tax_id, phone, email, address, active) VALUES (?, ?, ?, ?, ?, 1)
`);
const updateStmt = db.prepare(`
  UPDATE customers SET name=?, tax_id=?, phone=?, email=?, address=?, active=? WHERE id=?
`);

router.get('/', asyncHandler(async (req, res) => {
  const { search } = req.query;
  if (search) {
    return res.json(db.prepare(
      "SELECT * FROM customers WHERE active = 1 AND name LIKE ? ORDER BY name"
    ).all(`%${search}%`));
  }
  res.json(listStmt.all());
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const sales = db.prepare(`
    SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(req.params.id);
  res.json(sales);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, taxId, phone, email, address } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre es requerido');
  const id = insertStmt.run(name.trim(), taxId || null, phone || null, email || null, address || null).lastInsertRowid;
  logAction(req, 'create', 'customer', id, { name });
  res.status(201).json(getStmt.get(id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Cliente no encontrado');
  const { name, taxId, phone, email, address, active } = req.body;
  updateStmt.run(
    name ?? existing.name,
    taxId ?? existing.tax_id,
    phone ?? existing.phone,
    email ?? existing.email,
    address ?? existing.address,
    active ?? existing.active,
    req.params.id
  );
  logAction(req, 'update', 'customer', req.params.id, req.body);
  res.json(getStmt.get(req.params.id));
}));

router.delete('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Cliente no encontrado');
  db.prepare('UPDATE customers SET active = 0 WHERE id = ?').run(req.params.id);
  logAction(req, 'deactivate', 'customer', req.params.id, null);
  res.status(204).end();
}));

module.exports = router;
