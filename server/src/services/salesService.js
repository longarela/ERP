const db = require('../db/connection');
const ApiError = require('../utils/ApiError');
const stockService = require('./stockService');

const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
const insertSale = db.prepare(`
  INSERT INTO sales (number, customer_id, user_id, subtotal, discount_total, tax_total, total, payment_method, amount_paid, change_given, status, created_at)
  VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada', datetime('now'))
`);
const updateSaleNumber = db.prepare("UPDATE sales SET number = ? WHERE id = ?");
const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, tax_rate, subtotal)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertMovement = db.prepare(`
  INSERT INTO stock_movements (product_id, warehouse_id, batch_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
  VALUES (?, NULL, NULL, 'venta', ?, NULL, NULL, 'sale', ?, ?, datetime('now'))
`);
const getSaleById = db.prepare('SELECT * FROM sales WHERE id = ?');
const getSaleItems = db.prepare(`
  SELECT si.*, p.name AS product_name, p.code AS product_code
  FROM sale_items si JOIN products p ON p.id = si.product_id
  WHERE si.sale_id = ?
`);
const markSaleVoided = db.prepare("UPDATE sales SET status = 'anulada' WHERE id = ?");
const insertReturnMovement = db.prepare(`
  INSERT INTO stock_movements (product_id, warehouse_id, batch_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
  VALUES (?, NULL, NULL, 'devolucion_cliente', ?, NULL, ?, 'sale_void', ?, ?, datetime('now'))
`);
const bumpStockBack = db.prepare("UPDATE products SET stock_actual = stock_actual + ? WHERE id = ?");

const createSale = db.transaction((params) => {
  const { items, customerId, paymentMethod, amountPaid, discountTotal = 0, userId } = params;
  if (!items || items.length === 0) throw new ApiError(400, 'La venta debe tener al menos un producto');

  let subtotal = 0;
  let taxTotal = 0;
  const computed = [];

  for (const item of items) {
    const product = getProduct.get(item.productId);
    if (!product) throw new ApiError(404, `Producto ${item.productId} no encontrado`);
    if (!product.active) throw new ApiError(400, `"${product.name}" no está disponible para la venta`);
    const qty = Number(item.quantity);
    if (!qty || qty <= 0) throw new ApiError(400, `Cantidad inválida para "${product.name}"`);

    const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : product.sale_price;
    const lineDiscount = Number(item.discount || 0);
    const gross = unitPrice * qty - lineDiscount;
    if (gross < 0) throw new ApiError(400, `Descuento inválido para "${product.name}"`);
    const net = gross / (1 + product.iva_rate / 100);
    const tax = gross - net;
    subtotal += net;
    taxTotal += tax;
    computed.push({ product, qty, unitPrice, lineDiscount, taxRate: product.iva_rate, gross });
  }

  const globalDiscount = Number(discountTotal || 0);
  const total = Math.round((subtotal + taxTotal - globalDiscount) * 100) / 100;
  if (total < 0) throw new ApiError(400, 'El descuento total supera el importe de la venta');

  let paid = amountPaid != null ? Number(amountPaid) : total;
  if (paymentMethod === 'efectivo') {
    if (paid < total) throw new ApiError(400, 'El importe abonado es menor al total de la venta');
  } else {
    paid = total;
  }
  const change = paymentMethod === 'efectivo' ? Math.round((paid - total) * 100) / 100 : 0;

  const saleId = insertSale.run(
    customerId || null,
    userId,
    Math.round(subtotal * 100) / 100,
    globalDiscount,
    Math.round(taxTotal * 100) / 100,
    total,
    paymentMethod,
    paid,
    change
  ).lastInsertRowid;
  updateSaleNumber.run(`V-${String(saleId).padStart(6, '0')}`, saleId);

  for (const c of computed) {
    insertSaleItem.run(saleId, c.product.id, c.qty, c.unitPrice, c.lineDiscount, c.taxRate, Math.round(c.gross * 100) / 100);
    stockService.consumeForSale(c.product.id, c.qty);
    insertMovement.run(c.product.id, -c.qty, saleId, userId);
  }

  return getFullSale(saleId);
});

function getFullSale(saleId) {
  const sale = getSaleById.get(saleId);
  if (!sale) throw new ApiError(404, 'Venta no encontrada');
  const items = getSaleItems.all(saleId);
  return { ...sale, items };
}

const voidSale = db.transaction(({ saleId, userId, reason }) => {
  const sale = getSaleById.get(saleId);
  if (!sale) throw new ApiError(404, 'Venta no encontrada');
  if (sale.status === 'anulada') throw new ApiError(400, 'La venta ya fue anulada');
  const items = getSaleItems.all(saleId);
  for (const item of items) {
    insertReturnMovement.run(item.product_id, item.quantity, reason || 'Anulación de venta', saleId, userId);
    bumpStockBack.run(item.quantity, item.product_id);
  }
  markSaleVoided.run(saleId);
  return getFullSale(saleId);
});

module.exports = { createSale, getFullSale, voidSale };
