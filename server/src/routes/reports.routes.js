const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { sendCsv } = require('../utils/csv');

const router = express.Router();
router.use(requireAuth);

function salesByPeriodQuery({ from, to }) {
  let query = `
    SELECT date(sa.created_at) AS period, COUNT(DISTINCT sa.id) AS sales_count,
      SUM(si.subtotal) AS total, SUM(si.quantity) AS units
    FROM sale_items si
    JOIN sales sa ON sa.id = si.sale_id
    WHERE sa.status = 'completada'
  `;
  const params = [];
  if (from) { query += ' AND date(sa.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(sa.created_at) <= date(?)'; params.push(to); }
  query += ' GROUP BY date(sa.created_at) ORDER BY period';
  return db.prepare(query).all(...params);
}

function salesByProductQuery({ from, to }) {
  let query = `
    SELECT p.code, p.name AS product, COALESCE(c.name, 'Sin categoría') AS category,
      SUM(si.quantity) AS units, SUM(si.subtotal) AS total
    FROM sale_items si
    JOIN sales sa ON sa.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE sa.status = 'completada'
  `;
  const params = [];
  if (from) { query += ' AND date(sa.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(sa.created_at) <= date(?)'; params.push(to); }
  query += ' GROUP BY p.id ORDER BY total DESC';
  return db.prepare(query).all(...params);
}

function salesByCategoryQuery({ from, to }) {
  let query = `
    SELECT COALESCE(c.name, 'Sin categoría') AS category,
      SUM(si.quantity) AS units, SUM(si.subtotal) AS total
    FROM sale_items si
    JOIN sales sa ON sa.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE sa.status = 'completada'
  `;
  const params = [];
  if (from) { query += ' AND date(sa.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(sa.created_at) <= date(?)'; params.push(to); }
  query += ' GROUP BY c.name ORDER BY total DESC';
  return db.prepare(query).all(...params);
}

function inventoryQuery() {
  return db.prepare(`
    SELECT p.code, p.name, COALESCE(c.name, 'Sin categoría') AS category,
      p.stock_actual, p.stock_min, p.cost_price, p.sale_price,
      ROUND(p.stock_actual * p.cost_price, 2) AS valor_costo,
      ROUND(p.stock_actual * p.sale_price, 2) AS valor_venta
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 ORDER BY category, p.name
  `).all();
}

router.get('/sales', asyncHandler(async (req, res) => {
  const { from, to, groupBy } = req.query;
  if (groupBy === 'product') return res.json(salesByProductQuery({ from, to }));
  if (groupBy === 'category') return res.json(salesByCategoryQuery({ from, to }));
  return res.json(salesByPeriodQuery({ from, to }));
}));

router.get('/sales.csv', asyncHandler(async (req, res) => {
  const { from, to, groupBy } = req.query;
  const rows = groupBy === 'product' ? salesByProductQuery({ from, to })
    : groupBy === 'category' ? salesByCategoryQuery({ from, to })
    : salesByPeriodQuery({ from, to });
  sendCsv(res, `ventas_${groupBy || 'periodo'}.csv`, rows);
}));

router.get('/inventory', asyncHandler(async (req, res) => {
  res.json(inventoryQuery());
}));

router.get('/inventory.csv', asyncHandler(async (req, res) => {
  sendCsv(res, 'inventario.csv', inventoryQuery());
}));

router.get('/movements.csv', asyncHandler(async (req, res) => {
  const { from, to, type } = req.query;
  let query = `
    SELECT m.created_at, p.code, p.name AS product, m.type, m.quantity, m.reason, u.full_name AS usuario
    FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
    WHERE 1=1
  `;
  const params = [];
  if (from) { query += ' AND date(m.created_at) >= date(?)'; params.push(from); }
  if (to) { query += ' AND date(m.created_at) <= date(?)'; params.push(to); }
  if (type) { query += ' AND m.type = ?'; params.push(type); }
  query += ' ORDER BY m.created_at DESC';
  sendCsv(res, 'movimientos.csv', db.prepare(query).all(...params));
}));

module.exports = router;
