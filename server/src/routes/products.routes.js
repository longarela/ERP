const express = require('express');
const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(requireAuth);

const baseSelect = `
  SELECT p.*, c.name AS category_name, s.name AS supplier_name,
    CASE WHEN p.track_expiry = 1 THEN COALESCE((
      SELECT SUM(b.quantity) FROM product_batches b
      WHERE b.product_id = p.id AND b.status = 'active'
        AND (b.expiry_date IS NULL OR date(b.expiry_date) >= date('now'))
    ), 0) ELSE p.stock_actual END AS available_stock
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

const getStmt = db.prepare(`${baseSelect} WHERE p.id = ?`);
const insertStmt = db.prepare(`
  INSERT INTO products (code, barcode, name, description, category_id, supplier_id, unit, cost_price, sale_price, iva_rate, stock_min, stock_actual, track_expiry, image_url, active)
  VALUES (@code, @barcode, @name, @description, @category_id, @supplier_id, @unit, @cost_price, @sale_price, @iva_rate, @stock_min, 0, @track_expiry, @image_url, 1)
`);
const updateStmt = db.prepare(`
  UPDATE products SET
    code=@code, barcode=@barcode, name=@name, description=@description, category_id=@category_id,
    supplier_id=@supplier_id, unit=@unit, cost_price=@cost_price, sale_price=@sale_price, iva_rate=@iva_rate,
    stock_min=@stock_min, track_expiry=@track_expiry, image_url=@image_url, active=@active, updated_at=datetime('now')
  WHERE id=@id
`);
const codeExistsStmt = db.prepare('SELECT id FROM products WHERE code = ? AND id != ?');
const barcodeExistsStmt = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?');

router.get('/', asyncHandler(async (req, res) => {
  const { search, categoryId, lowStock, active } = req.query;
  let query = baseSelect + ' WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    query += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  if (lowStock === 'true') {
    query += ' AND p.stock_actual <= p.stock_min';
  }
  if (active !== 'all') {
    query += ' AND p.active = 1';
  }
  query += ' ORDER BY p.name';
  res.json(db.prepare(query).all(...params));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const product = getStmt.get(req.params.id);
  if (!product) throw new ApiError(404, 'Producto no encontrado');
  res.json(product);
}));

router.get('/:id/batches', asyncHandler(async (req, res) => {
  const batches = db.prepare(`
    SELECT * FROM product_batches WHERE product_id = ? AND status != 'discarded' ORDER BY expiry_date ASC
  `).all(req.params.id);
  res.json(batches);
}));

router.get('/:id/movements', asyncHandler(async (req, res) => {
  const movements = db.prepare(`
    SELECT m.*, u.full_name AS user_name
    FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200
  `).all(req.params.id);
  res.json(movements);
}));

router.post('/', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.code || !b.name) throw new ApiError(400, 'Código y nombre son requeridos');
  if (codeExistsStmt.get(b.code, -1)) throw new ApiError(400, 'Ya existe un producto con ese código');
  if (b.barcode && barcodeExistsStmt.get(b.barcode, -1)) throw new ApiError(400, 'Ya existe un producto con ese código de barras');

  const id = insertStmt.run({
    code: b.code,
    barcode: b.barcode || null,
    name: b.name,
    description: b.description || null,
    category_id: b.categoryId || null,
    supplier_id: b.supplierId || null,
    unit: b.unit || 'unidad',
    cost_price: Number(b.costPrice || 0),
    sale_price: Number(b.salePrice || 0),
    iva_rate: Number(b.ivaRate ?? 21),
    stock_min: Number(b.stockMin || 0),
    track_expiry: b.trackExpiry ? 1 : 0,
    image_url: b.imageUrl || null,
  }).lastInsertRowid;

  logAction(req, 'create', 'product', id, { name: b.name, code: b.code });
  res.status(201).json(getStmt.get(id));
}));

router.put('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Producto no encontrado');
  const b = req.body;
  if (b.code && codeExistsStmt.get(b.code, req.params.id)) throw new ApiError(400, 'Ya existe un producto con ese código');
  if (b.barcode && barcodeExistsStmt.get(b.barcode, req.params.id)) throw new ApiError(400, 'Ya existe un producto con ese código de barras');

  updateStmt.run({
    id: req.params.id,
    code: b.code ?? existing.code,
    barcode: b.barcode !== undefined ? b.barcode : existing.barcode,
    name: b.name ?? existing.name,
    description: b.description !== undefined ? b.description : existing.description,
    category_id: b.categoryId !== undefined ? b.categoryId : existing.category_id,
    supplier_id: b.supplierId !== undefined ? b.supplierId : existing.supplier_id,
    unit: b.unit ?? existing.unit,
    cost_price: b.costPrice !== undefined ? Number(b.costPrice) : existing.cost_price,
    sale_price: b.salePrice !== undefined ? Number(b.salePrice) : existing.sale_price,
    iva_rate: b.ivaRate !== undefined ? Number(b.ivaRate) : existing.iva_rate,
    stock_min: b.stockMin !== undefined ? Number(b.stockMin) : existing.stock_min,
    track_expiry: b.trackExpiry !== undefined ? (b.trackExpiry ? 1 : 0) : existing.track_expiry,
    image_url: b.imageUrl !== undefined ? b.imageUrl : existing.image_url,
    active: b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
  });
  logAction(req, 'update', 'product', req.params.id, b);
  res.json(getStmt.get(req.params.id));
}));

router.delete('/:id', requireRole('admin', 'gerente'), asyncHandler(async (req, res) => {
  const existing = getStmt.get(req.params.id);
  if (!existing) throw new ApiError(404, 'Producto no encontrado');
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  logAction(req, 'deactivate', 'product', req.params.id, null);
  res.status(204).end();
}));

module.exports = router;
