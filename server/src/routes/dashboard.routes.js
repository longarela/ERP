const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const expiryService = require('../services/expiryService');
const reorderService = require('../services/reorderService');

const router = express.Router();
router.use(requireAuth);

router.get('/kpis', asyncHandler(async (req, res) => {
  const todaySales = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
    FROM sales WHERE date(created_at) = date('now') AND status = 'completada'
  `).get();

  const stockValue = db.prepare(`
    SELECT COALESCE(SUM(stock_actual * cost_price), 0) AS cost_value,
           COALESCE(SUM(stock_actual * sale_price), 0) AS sale_value,
           COALESCE(SUM(stock_actual), 0) AS total_units
    FROM products WHERE active = 1
  `).get();

  const lowStockCount = db.prepare(`
    SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock_actual <= stock_min
  `).get().n;

  const expiredCount = expiryService.getExpired().length;
  const nearExpiryCount = expiryService.getNearExpiry(30).length;
  const reorderCount = reorderService.getAllSuggestions(30, { onlyNeeded: true }).length;

  const salesByCategory = db.prepare(`
    SELECT COALESCE(c.name, 'Sin categoría') AS category, SUM(si.subtotal) AS total
    FROM sale_items si
    JOIN sales sa ON sa.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE date(sa.created_at) >= date('now', '-30 days') AND sa.status = 'completada'
    GROUP BY c.name ORDER BY total DESC
  `).all();

  const salesLast7Days = db.prepare(`
    SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS total
    FROM sales
    WHERE date(created_at) >= date('now', '-6 days') AND status = 'completada'
    GROUP BY date(created_at)
  `).all();
  const salesByDayMap = new Map(salesLast7Days.map((r) => [r.day, r.total]));
  const salesTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    salesTrend.push({ day: key, total: salesByDayMap.get(key) || 0 });
  }

  const topProducts = db.prepare(`
    SELECT p.name, SUM(si.quantity) AS qty, SUM(si.subtotal) AS total
    FROM sale_items si
    JOIN sales sa ON sa.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE date(sa.created_at) >= date('now', '-30 days') AND sa.status = 'completada'
    GROUP BY p.id ORDER BY qty DESC LIMIT 8
  `).all();

  res.json({
    todaySales,
    stockValue,
    lowStockCount,
    expiredCount,
    nearExpiryCount,
    reorderCount,
    salesByCategory,
    salesTrend,
    topProducts,
  });
}));

module.exports = router;
