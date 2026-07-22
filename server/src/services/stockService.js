const db = require('../db/connection');
const ApiError = require('../utils/ApiError');

const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
const updateProductStock = db.prepare('UPDATE products SET stock_actual = stock_actual + ?, updated_at = datetime(\'now\') WHERE id = ?');
const insertMovement = db.prepare(`
  INSERT INTO stock_movements (product_id, warehouse_id, batch_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
  VALUES (@product_id, @warehouse_id, @batch_id, @type, @quantity, @unit_cost, @reason, @reference_type, @reference_id, @user_id, datetime('now'))
`);
const insertBatch = db.prepare(`
  INSERT INTO product_batches (product_id, warehouse_id, batch_code, quantity, expiry_date, received_at, status)
  VALUES (?, ?, ?, ?, ?, datetime('now'), 'active')
`);
const getActiveBatchesFIFO = db.prepare(`
  SELECT * FROM product_batches
  WHERE product_id = ? AND status = 'active' AND quantity > 0
  ORDER BY (expiry_date IS NULL), expiry_date ASC, id ASC
`);
const getActiveNonExpiredBatchesFIFO = db.prepare(`
  SELECT * FROM product_batches
  WHERE product_id = ? AND status = 'active' AND quantity > 0
    AND (expiry_date IS NULL OR date(expiry_date) >= date('now'))
  ORDER BY (expiry_date IS NULL), expiry_date ASC, id ASC
`);
const decrementBatch = db.prepare('UPDATE product_batches SET quantity = quantity - ?, status = CASE WHEN quantity - ? <= 0 THEN \'depleted\' ELSE status END WHERE id = ?');

function findProductOrThrow(productId) {
  const product = getProduct.get(productId);
  if (!product) throw new ApiError(404, 'Producto no encontrado');
  return product;
}

/** Consume quantity from batches following FIFO by expiry date. Returns list of {batchId, quantity} consumed. */
function consumeBatchesFIFO(productId, qty, { allowExpired }) {
  const batches = allowExpired ? getActiveBatchesFIFO.all(productId) : getActiveNonExpiredBatchesFIFO.all(productId);
  let remaining = qty;
  const consumed = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    decrementBatch.run(take, take, batch.id);
    consumed.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }
  if (remaining > 0.0001) {
    throw new ApiError(400, allowExpired
      ? 'Stock insuficiente para esta operación'
      : 'Stock insuficiente o el producto disponible está vencido');
  }
  return consumed;
}

const addEntry = db.transaction((params) => {
  const { productId, quantity, unitCost, reason, referenceType, referenceId, userId, expiryDate, batchCode, warehouseId, type } = params;
  const product = findProductOrThrow(productId);
  if (quantity <= 0) throw new ApiError(400, 'La cantidad debe ser mayor a cero');
  if (product.track_expiry && !expiryDate) {
    throw new ApiError(400, 'Este producto requiere fecha de vencimiento para el lote ingresado');
  }
  let batchId = null;
  if (product.track_expiry) {
    batchId = insertBatch.run(productId, warehouseId || null, batchCode || null, quantity, expiryDate).lastInsertRowid;
  }
  insertMovement.run({
    product_id: productId,
    warehouse_id: warehouseId || null,
    batch_id: batchId,
    type: type || 'compra',
    quantity,
    unit_cost: unitCost ?? product.cost_price,
    reason: reason || null,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
    user_id: userId,
  });
  updateProductStock.run(quantity, productId);
  return findProductOrThrow(productId);
});

const adjustStock = db.transaction((params) => {
  const { productId, quantity, reason, userId, warehouseId } = params;
  const product = findProductOrThrow(productId);
  if (!reason || !reason.trim()) throw new ApiError(400, 'Debe indicar una justificación para el ajuste');
  if (quantity === 0) throw new ApiError(400, 'La cantidad de ajuste no puede ser cero');
  const type = quantity > 0 ? 'ajuste_positivo' : 'ajuste_negativo';

  if (quantity < 0) {
    if (product.track_expiry) {
      consumeBatchesFIFO(productId, Math.abs(quantity), { allowExpired: true });
    } else if (product.stock_actual + quantity < 0) {
      throw new ApiError(400, 'El ajuste dejaría el stock en negativo');
    }
  }

  insertMovement.run({
    product_id: productId,
    warehouse_id: warehouseId || null,
    batch_id: null,
    type,
    quantity,
    unit_cost: null,
    reason,
    reference_type: 'manual',
    reference_id: null,
    user_id: userId,
  });
  updateProductStock.run(quantity, productId);
  return findProductOrThrow(productId);
});

const registerLoss = db.transaction((params) => {
  const { productId, quantity, reason, userId, warehouseId } = params;
  const product = findProductOrThrow(productId);
  if (quantity <= 0) throw new ApiError(400, 'La cantidad debe ser mayor a cero');
  if (!reason || !reason.trim()) throw new ApiError(400, 'Debe indicar el motivo de la pérdida');

  if (product.track_expiry) {
    consumeBatchesFIFO(productId, quantity, { allowExpired: true });
  } else if (product.stock_actual - quantity < 0) {
    throw new ApiError(400, 'No hay stock suficiente para registrar esta pérdida');
  }

  insertMovement.run({
    product_id: productId,
    warehouse_id: warehouseId || null,
    batch_id: null,
    type: 'perdida',
    quantity: -quantity,
    unit_cost: null,
    reason,
    reference_type: 'manual',
    reference_id: null,
    user_id: userId,
  });
  updateProductStock.run(-quantity, productId);
  return findProductOrThrow(productId);
});

const discardBatch = db.transaction((params) => {
  const { batchId, userId, reason } = params;
  const batch = db.prepare('SELECT * FROM product_batches WHERE id = ?').get(batchId);
  if (!batch) throw new ApiError(404, 'Lote no encontrado');
  if (batch.status === 'discarded') throw new ApiError(400, 'El lote ya fue descartado');
  const qty = batch.quantity;
  db.prepare(`
    UPDATE product_batches
    SET status = 'discarded', discarded_at = datetime('now'), discarded_reason = ?, discarded_by = ?
    WHERE id = ?
  `).run(reason || 'Producto vencido', userId, batchId);

  if (qty > 0) {
    insertMovement.run({
      product_id: batch.product_id,
      warehouse_id: batch.warehouse_id,
      batch_id: batch.id,
      type: 'descarte_vencido',
      quantity: -qty,
      unit_cost: null,
      reason: reason || 'Producto vencido - descarte',
      reference_type: 'batch',
      reference_id: batch.id,
      user_id: userId,
    });
    updateProductStock.run(-qty, batch.product_id);
  }
  return db.prepare('SELECT * FROM product_batches WHERE id = ?').get(batchId);
});

/** Verifica y consume stock disponible (no vencido) para una venta. Usado dentro de la transaccion de venta. */
function consumeForSale(productId, qty) {
  const product = findProductOrThrow(productId);
  if (!product.active) throw new ApiError(400, `El producto "${product.name}" no está activo`);
  if (product.track_expiry) {
    consumeBatchesFIFO(productId, qty, { allowExpired: false });
  } else if (product.stock_actual < qty) {
    throw new ApiError(400, `Stock insuficiente para "${product.name}" (disponible: ${product.stock_actual})`);
  }
  updateProductStock.run(-qty, productId);
}

module.exports = {
  addEntry,
  adjustStock,
  registerLoss,
  discardBatch,
  consumeForSale,
  consumeBatchesFIFO,
  findProductOrThrow,
  insertMovement,
};
