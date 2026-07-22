const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth);

const listStmt = db.prepare('SELECT * FROM categories ORDER BY name');
const getStmt = db.prepare('SELECT * FROM categories WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
const updateStmt = db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM categories WHERE id = ?');
const countProductsStmt = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?');

router.get('/', asyncHandler(async (req, res) => {
  res.json(listStmt.all());
}));

router.post('/', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre es requerido');
  const id = insertStmt.run(name.trim(), description || null).lastInsertRowid;
  logAction(req, 'create', 'category', id, { name });
  res.status(201).json(getStmt.get(id));
}));

router.put('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Categoría no encontrada');
  const { name, description } = req.body;
  updateStmt.run(name || existing.name, description ?? existing.description, req.params.id);
  logAction(req, 'update', 'category', req.params.id, req.body);
  res.json(getStmt.get(req.params.id));
}));

router.delete('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Categoría no encontrada');
  const { n } = countProductsStmt.get(req.params.id);
  if (n > 0) throw new ApiError(400, 'No se puede eliminar: hay productos asociados a esta categoría');
  deleteStmt.run(req.params.id);
  logAction(req, 'delete', 'category', req.params.id, null);
  res.status(204).end();
}));

module.exports = router;
