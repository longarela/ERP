const db = require('../db/connection');
const ApiError = require('../utils/ApiError');
const stockService = require('./stockService');

const insertPO = db.prepare(`
  INSERT INTO purchase_orders (number, supplier_id, user_id, status, expected_date, notes, created_at)
  VALUES ('PENDING', ?, ?, 'borrador', ?, ?, datetime('now'))
`);
const updatePONumber = db.prepare('UPDATE purchase_orders SET number = ? WHERE id = ?');
const insertPOItem = db.prepare(`
  INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_suggested, quantity_ordered, unit_cost)
  VALUES (?, ?, ?, ?, ?)
`);
const getPO = db.prepare(`
  SELECT po.*, s.name AS supplier_name, u.full_name AS user_name
  FROM purchase_orders po
  JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN users u ON u.id = po.user_id
  WHERE po.id = ?
`);
const getPOItems = db.prepare(`
  SELECT poi.*, p.name AS product_name, p.code AS product_code, p.track_expiry
  FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id
  WHERE poi.purchase_order_id = ?
`);
const updatePOStatus = db.prepare('UPDATE purchase_orders SET status = ?, received_at = ? WHERE id = ?');
const updatePOItemReceived = db.prepare('UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?');
const markSuggestionOrdered = db.prepare("UPDATE reorder_suggestions SET status = 'ordenado' WHERE product_id = ? AND status = 'pendiente'");

const createPurchaseOrder = db.transaction((params) => {
  const { supplierId, expectedDate, notes, items, userId } = params;
  if (!items || items.length === 0) throw new ApiError(400, 'La orden debe tener al menos un producto');
  const poId = insertPO.run(supplierId, userId, expectedDate || null, notes || null).lastInsertRowid;
  updatePONumber.run(`OC-${String(poId).padStart(6, '0')}`, poId);
  for (const item of items) {
    insertPOItem.run(poId, item.productId, item.suggestedQty || 0, item.quantity, item.unitCost || 0);
    markSuggestionOrdered.run(item.productId);
  }
  return getFullPO(poId);
});

function getFullPO(poId) {
  const po = getPO.get(poId);
  if (!po) throw new ApiError(404, 'Orden de compra no encontrada');
  return { ...po, items: getPOItems.all(poId) };
}

const receivePurchaseOrder = db.transaction((params) => {
  const { poId, receivedItems, userId, warehouseId } = params;
  const po = getPO.get(poId);
  if (!po) throw new ApiError(404, 'Orden de compra no encontrada');
  if (po.status === 'recibido' || po.status === 'cancelado') {
    throw new ApiError(400, 'La orden ya fue recibida o cancelada');
  }
  const items = getPOItems.all(poId);
  let anyPending = false;

  for (const receivedItem of receivedItems) {
    const poItem = items.find((i) => i.id === receivedItem.itemId);
    if (!poItem) throw new ApiError(404, `Ítem ${receivedItem.itemId} no pertenece a esta orden`);
    const qty = Number(receivedItem.quantity || 0);
    if (qty <= 0) continue;

    stockService.addEntry({
      productId: poItem.product_id,
      quantity: qty,
      unitCost: poItem.unit_cost,
      reason: `Recepción orden de compra ${po.number}`,
      referenceType: 'purchase_order',
      referenceId: poId,
      userId,
      expiryDate: receivedItem.expiryDate || null,
      batchCode: receivedItem.batchCode || null,
      warehouseId: warehouseId || null,
      type: 'compra',
    });
    updatePOItemReceived.run((poItem.quantity_received || 0) + qty, poItem.id);
  }

  const refreshed = getPOItems.all(poId);
  anyPending = refreshed.some((i) => i.quantity_received < i.quantity_ordered);
  updatePOStatus.run(anyPending ? 'recibido_parcial' : 'recibido', anyPending ? null : new Date().toISOString(), poId);
  return getFullPO(poId);
});

module.exports = { createPurchaseOrder, getFullPO, receivePurchaseOrder };
