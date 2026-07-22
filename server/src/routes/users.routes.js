const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const listStmt = db.prepare('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY full_name');
const getStmt = db.prepare('SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?');
const getByUsernameStmt = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?');
const insertStmt = db.prepare(`
  INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)
`);
const updateStmt = db.prepare('UPDATE users SET full_name=?, role=?, active=? WHERE id=?');
const updatePasswordStmt = db.prepare('UPDATE users SET password_hash=? WHERE id=?');

router.get('/', asyncHandler(async (req, res) => {
  res.json(listStmt.all());
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, fullName, role } = req.body;
  if (!username || !password || !fullName || !role) throw new ApiError(400, 'Todos los campos son requeridos');
  if (getByUsernameStmt.get(username, -1)) throw new ApiError(400, 'Ya existe un usuario con ese nombre de usuario');
  const hash = bcrypt.hashSync(password, 10);
  const id = insertStmt.run(username, hash, fullName, role).lastInsertRowid;
  logAction(req, 'create', 'user', id, { username, role });
  res.status(201).json(getStmt.get(id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Usuario no encontrado');
  const { fullName, role, active, password } = req.body;
  updateStmt.run(fullName ?? existing.full_name, role ?? existing.role, active !== undefined ? (active ? 1 : 0) : existing.active, req.params.id);
  if (password) {
    updatePasswordStmt.run(bcrypt.hashSync(password, 10), req.params.id);
  }
  logAction(req, 'update', 'user', req.params.id, { fullName, role, active });
  res.json(getStmt.get(req.params.id));
}));

module.exports = router;
