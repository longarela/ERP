const db = require('../db/connection');

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');

function getThresholds() {
  const row = getSetting.get('near_expiry_thresholds_days');
  const raw = row ? row.value : '30,15,7';
  return raw.split(',').map((n) => Number(n.trim())).sort((a, b) => a - b);
}

const nearExpiryQuery = db.prepare(`
  SELECT b.*, p.name AS product_name, p.code AS product_code, p.unit,
    CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry
  FROM product_batches b
  JOIN products p ON p.id = b.product_id
  WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date IS NOT NULL
    AND date(b.expiry_date) >= date('now')
    AND julianday(b.expiry_date) - julianday('now') <= ?
  ORDER BY b.expiry_date ASC
`);

const expiredQuery = db.prepare(`
  SELECT b.*, p.name AS product_name, p.code AS product_code, p.unit,
    CAST(julianday('now') - julianday(b.expiry_date) AS INTEGER) AS days_expired
  FROM product_batches b
  JOIN products p ON p.id = b.product_id
  WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date IS NOT NULL
    AND date(b.expiry_date) < date('now')
  ORDER BY b.expiry_date ASC
`);

const discardedHistoryQuery = db.prepare(`
  SELECT b.*, p.name AS product_name, p.code AS product_code, u.full_name AS discarded_by_name
  FROM product_batches b
  JOIN products p ON p.id = b.product_id
  LEFT JOIN users u ON u.id = b.discarded_by
  WHERE b.status = 'discarded'
  ORDER BY b.discarded_at DESC
  LIMIT 200
`);

function getNearExpiry(maxDays) {
  const thresholds = getThresholds();
  const limit = maxDays || thresholds[0] || 30;
  const rows = nearExpiryQuery.all(limit);
  return rows.map((r) => ({
    ...r,
    alert_level: thresholds.find((t) => r.days_to_expiry <= t) || thresholds[thresholds.length - 1],
  }));
}

function getExpired() {
  return expiredQuery.all();
}

function getDiscardHistory() {
  return discardedHistoryQuery.all();
}

module.exports = { getThresholds, getNearExpiry, getExpired, getDiscardHistory };
