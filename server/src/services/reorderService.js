const db = require('../db/connection');

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const getActiveProducts = db.prepare('SELECT * FROM products WHERE active = 1');
const getProductWithSupplier = db.prepare(`
  SELECT p.*, s.name AS supplier_name, s.lead_time_days AS supplier_lead_time
  FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE p.id = ?
`);
const getDailySalesRows = db.prepare(`
  SELECT date(sa.created_at) AS day, SUM(si.quantity) AS qty
  FROM sale_items si
  JOIN sales sa ON sa.id = si.sale_id
  WHERE si.product_id = ? AND sa.status = 'completada'
    AND date(sa.created_at) >= date('now', ?)
  GROUP BY date(sa.created_at)
`);

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stdDev(arr, avg) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function getSettingNumber(key, fallback) {
  const row = getSetting.get(key);
  return row ? Number(row.value) : fallback;
}

/**
 * Analiza el historial de ventas de un producto en la ventana indicada y
 * calcula punto de reorden y cantidad sugerida.
 *
 * reorder_point = demanda_promedio_diaria * lead_time + stock_seguridad
 * stock_seguridad = z * desvio_estandar_demanda_diaria * sqrt(lead_time)
 * cantidad_sugerida = demanda_promedio_diaria * (lead_time + periodo_revision) + stock_seguridad - stock_actual
 */
function analyzeProduct(productId, windowDays = 30) {
  const product = getProductWithSupplier.get(productId);
  if (!product) return null;

  const rows = getDailySalesRows.all(productId, `-${windowDays} days`);
  const soldByDay = new Map(rows.map((r) => [r.day, r.qty]));
  const dailyQuantities = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyQuantities.push(soldByDay.get(key) || 0);
  }

  const avgDailySales = Math.round(mean(dailyQuantities) * 1000) / 1000;
  const std = Math.round(stdDev(dailyQuantities, avgDailySales) * 1000) / 1000;
  const leadTimeDays = product.supplier_lead_time || 7;
  const reviewPeriodDays = getSettingNumber('reorder_review_period_days', 7);
  const z = getSettingNumber('reorder_safety_z', 1.65);

  const safetyStock = z * std * Math.sqrt(leadTimeDays);
  const reorderPoint = avgDailySales * leadTimeDays + safetyStock;
  const rawSuggestedQty = avgDailySales * (leadTimeDays + reviewPeriodDays) + safetyStock - product.stock_actual;
  const suggestedQty = Math.max(0, Math.ceil(rawSuggestedQty));
  const needsReorder = product.stock_actual <= Math.max(reorderPoint, product.stock_min);

  return {
    product,
    windowDays,
    avgDailySales,
    stdDevDailySales: std,
    leadTimeDays,
    safetyStock: Math.round(safetyStock * 100) / 100,
    reorderPoint: Math.round(reorderPoint * 100) / 100,
    suggestedQty,
    needsReorder,
    daysOfStockRemaining: avgDailySales > 0 ? Math.round((product.stock_actual / avgDailySales) * 10) / 10 : null,
  };
}

function getAllSuggestions(windowDays = 30, { onlyNeeded = true } = {}) {
  const products = getActiveProducts.all();
  const results = products
    .map((p) => analyzeProduct(p.id, windowDays))
    .filter((r) => r && (!onlyNeeded || r.needsReorder));
  results.sort((a, b) => (b.reorderPoint - b.product.stock_actual) - (a.reorderPoint - a.product.stock_actual));
  return results;
}

const insertSuggestion = db.prepare(`
  INSERT INTO reorder_suggestions (product_id, avg_daily_sales, std_dev_daily_sales, lead_time_days, reorder_point, suggested_qty, window_days, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))
`);

function persistSuggestions(windowDays = 30) {
  const suggestions = getAllSuggestions(windowDays, { onlyNeeded: true });
  const insertMany = db.transaction((items) => {
    for (const s of items) {
      insertSuggestion.run(s.product.id, s.avgDailySales, s.stdDevDailySales, s.leadTimeDays, s.reorderPoint, s.suggestedQty, s.windowDays);
    }
  });
  insertMany(suggestions);
  return suggestions;
}

module.exports = { analyzeProduct, getAllSuggestions, persistSuggestions };
