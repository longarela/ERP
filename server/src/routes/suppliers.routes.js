const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth);

const listStmt = db.prepare('SELECT * FROM suppliers ORDER BY name');
const getStmt = db.prepare('SELECT * FROM suppliers WHERE id = ?');
const insertStmt = db.prepare(`
  INSERT INTO suppliers (name, contact_name, phone, email, lead_time_days, active)
  VALUES (?, ?, ?, ?, ?, 1)
`);
const updateStmt = db.prepare(`
  UPDATE suppliers SET name=?, contact_name=?, phone=?, email=?, lead_time_days=?, active=? WHERE id=?
`);
const deleteStmt = db.prepare('UPDATE suppliers SET active = 0 WHERE id = ?');

router.get('/', asyncHandler(async (req, res) => {
  res.json(listStmt.all());
}));

router.post('/', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const { name, contactName, phone, email, leadTimeDays } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre es requerido');
  const id = insertStmt.run(name.trim(), contactName || null, phone || null, email || null, leadTimeDays ?? 7).lastInsertRowid;
  logAction(req, 'create', 'supplier', id, { name });
  res.status(201).json(getStmt.get(id));
}));

router.put('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Proveedor no encontrado');
  const { name, contactName, phone, email, leadTimeDays, active } = req.body;
  updateStmt.run(
    name ?? existing.name,
    contactName ?? existing.contact_name,
    phone ?? existing.phone,
    email ?? existing.email,
    leadTimeDays ?? existing.lead_time_days,
    active ?? existing.active,
    req.params.id
  );
  logAction(req, 'update', 'supplier', req.params.id, req.body);
  res.json(getStmt.get(req.params.id));
}));

router.delete('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Proveedor no encontrado');
  deleteStmt.run(req.params.id);
  logAction(req, 'deactivate', 'supplier', req.params.id, null);
  res.status(204).end();
}));

module.exports = router;
