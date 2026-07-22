const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const getUserById = db.prepare('SELECT id, username, full_name, role, active FROM users WHERE id = ?');

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw new ApiError(400, 'Usuario y contraseña son requeridos');

  const user = getUserByUsername.get(username);
  if (!user || !user.active) throw new ApiError(401, 'Usuario o contraseña incorrectos');

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Usuario o contraseña incorrectos');

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  req.user = { id: user.id, username: user.username };
  logAction(req, 'login', 'user', user.id, null);

  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = getUserById.get(req.user.id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');
  res.json(user);
}));

module.exports = router;
