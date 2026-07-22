const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { runBackup } = require('../services/backupService');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.post('/', asyncHandler(async (req, res) => {
  const dest = runBackup();
  logAction(req, 'manual_backup', 'system', null, { file: dest });
  res.status(201).json({ file: dest });
}));

module.exports = router;
