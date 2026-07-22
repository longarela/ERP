const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'gerente'));

router.get('/', asyncHandler(async (req, res) => {
  const { entity, from, to } = req.query;
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (entity) { query += ' AND entity = ?'; params.push(entity); }
  if (from) { query += ' AND date(created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(created_at) <= date(?)'; params.push(to); }
  query += ' ORDER BY created_at DESC, id DESC LIMIT 500';
  res.json(db.prepare(query).all(...params));
}));

module.exports = router;
