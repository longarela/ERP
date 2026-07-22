const db = require('../db/connection');

const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_id, username, action, entity, entity_id, details, created_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

function logAction(req, action, entity, entityId, details) {
  const userId = req.user ? req.user.id : null;
  const username = req.user ? req.user.username : 'sistema';
  insertAudit.run(
    userId,
    username,
    action,
    entity,
    entityId ?? null,
    details ? JSON.stringify(details) : null
  );
}

module.exports = { logAction };
