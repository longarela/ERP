const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth);

const upsertStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
}));

router.put('/', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const txn = db.transaction((entries) => {
    for (const [key, value] of entries) upsertStmt.run(key, String(value));
  });
  txn(Object.entries(updates));
  logAction(req, 'update_settings', 'settings', null, updates);
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
}));

module.exports = router;
