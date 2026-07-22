/*
 * Script de carga de datos de ejemplo.
 * Ejecutar con: npm run seed (desde /server)
 * Es idempotente destructivo: borra el contenido de las tablas transaccionales
 * y de catalogo antes de recrearlas, para poder correrlo las veces que haga falta.
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');

function daysAgo(n, hour = 10, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.weight) return it;
    r -= it.weight;
  }
  return items[items.length - 1];
}

console.log('Limpiando tablas...');
db.exec(`
  DELETE FROM sale_items;
  DELETE FROM sales;
  DELETE FROM stock_movements;
  DELETE FROM reorder_suggestions;
  DELETE FROM purchase_order_items;
  DELETE FROM purchase_orders;
  DELETE FROM product_batches;
  DELETE FROM stock_by_location;
  DELETE FROM products;
  DELETE FROM suppliers;
  DELETE FROM categories;
  DELETE FROM customers;
  DELETE FROM warehouses;
  DELETE FROM audit_log;
  DELETE FROM users;
  DELETE FROM settings;
  DELETE FROM sqlite_sequence;
`);

// ---------------------------------------------------------------------------
// Configuracion general
// ---------------------------------------------------------------------------
const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('business_name', 'Almacén San Martín');
insertSetting.run('default_iva', '21');
insertSetting.run('currency', 'ARS');
insertSetting.run('near_expiry_thresholds_days', '30,15,7');
insertSetting.run('reorder_review_period_days', '7');
insertSetting.run('reorder_safety_z', '1.65');

// ---------------------------------------------------------------------------
// Depositos
// ---------------------------------------------------------------------------
const insertWarehouse = db.prepare('INSERT INTO warehouses (name, is_default) VALUES (?, ?)');
const whCentral = insertWarehouse.run('Depósito Central', 1).lastInsertRowid;
insertWarehouse.run('Local de Ventas', 0);

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)'
);
const users = [
  ['admin', 'admin123', 'Administrador del Sistema', 'admin'],
  ['gerente', 'gerente123', 'María Gómez', 'gerente'],
  ['vendedor', 'vendedor123', 'Juan Pérez', 'vendedor'],
];
const userIds = {};
for (const [username, pass, name, role] of users) {
  const hash = bcrypt.hashSync(pass, 10);
  const id = insertUser.run(username, hash, name, role).lastInsertRowid;
  userIds[username] = id;
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
const categoryNames = ['Almacén', 'Bebidas', 'Lácteos', 'Limpieza', 'Perfumería', 'Snacks y Golosinas', 'Congelados'];
const categoryIds = {};
for (const name of categoryNames) {
  categoryIds[name] = insertCategory.run(name, null).lastInsertRowid;
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------
const insertSupplier = db.prepare(
  'INSERT INTO suppliers (name, contact_name, phone, email, lead_time_days) VALUES (?, ?, ?, ?, ?)'
);
const suppliers = [
  ['Distribuidora Norte S.A.', 'Carlos Ibáñez', '011-4555-1010', 'ventas@distnorte.com.ar', 5],
  ['Alimentos del Sur SRL', 'Laura Medina', '011-4555-2020', 'contacto@alimentosdelsur.com.ar', 10],
  ['Lácteos La Serrana', 'Diego Funes', '0351-455-3030', 'pedidos@laserrana.com.ar', 3],
  ['Bebidas Andinas', 'Rocío Salas', '011-4555-4040', 'info@bebidasandinas.com.ar', 7],
  ['Limpieza Total Mayorista', 'Martín Rey', '011-4555-5050', 'ventas@limpiezatotal.com.ar', 6],
];
const supplierIds = {};
for (const [name, contact, phone, email, lead] of suppliers) {
  supplierIds[name] = insertSupplier.run(name, contact, phone, email, lead).lastInsertRowid;
}

// ---------------------------------------------------------------------------
// Productos
// avgDailyRate: ventas promedio simuladas por dia (usado solo en el seed)
// ---------------------------------------------------------------------------
const productDefs = [
  { code: 'ALM-001', barcode: '7790001000019', name: 'Arroz Largo Fino 1kg', cat: 'Almacén', sup: 'Distribuidora Norte S.A.', unit: 'unidad', cost: 900, price: 1450, iva: 10.5, stockMin: 40, trackExpiry: 0, rate: 6 },
  { code: 'ALM-002', barcode: '7790001000026', name: 'Fideos Tallarín 500g', cat: 'Almacén', sup: 'Distribuidora Norte S.A.', unit: 'unidad', cost: 650, price: 1050, iva: 10.5, stockMin: 50, trackExpiry: 0, rate: 7 },
  { code: 'ALM-003', barcode: '7790001000033', name: 'Aceite de Girasol 1.5L', cat: 'Almacén', sup: 'Distribuidora Norte S.A.', unit: 'unidad', cost: 1600, price: 2400, iva: 10.5, stockMin: 30, trackExpiry: 1, rate: 4 },
  { code: 'ALM-004', barcode: '7790001000040', name: 'Azúcar 1kg', cat: 'Almacén', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 750, price: 1150, iva: 10.5, stockMin: 40, trackExpiry: 0, rate: 5 },
  { code: 'ALM-005', barcode: '7790001000057', name: 'Harina 0000 1kg', cat: 'Almacén', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 600, price: 980, iva: 10.5, stockMin: 45, trackExpiry: 0, rate: 6 },
  { code: 'ALM-006', barcode: '7790001000064', name: 'Yerba Mate 1kg', cat: 'Almacén', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 2200, price: 3400, iva: 10.5, stockMin: 25, trackExpiry: 0, rate: 3.5 },
  { code: 'BEB-001', barcode: '7790002000011', name: 'Gaseosa Cola 2.25L', cat: 'Bebidas', sup: 'Bebidas Andinas', unit: 'unidad', cost: 1100, price: 1800, iva: 21, stockMin: 40, trackExpiry: 1, rate: 8 },
  { code: 'BEB-002', barcode: '7790002000028', name: 'Agua Mineral sin gas 2L', cat: 'Bebidas', sup: 'Bebidas Andinas', unit: 'unidad', cost: 500, price: 850, iva: 21, stockMin: 50, trackExpiry: 1, rate: 6 },
  { code: 'BEB-003', barcode: '7790002000035', name: 'Cerveza Rubia Lata 473ml', cat: 'Bebidas', sup: 'Bebidas Andinas', unit: 'unidad', cost: 700, price: 1200, iva: 21, stockMin: 60, trackExpiry: 1, rate: 9 },
  { code: 'BEB-004', barcode: '7790002000042', name: 'Jugo Exprimido Naranja 1L', cat: 'Bebidas', sup: 'Bebidas Andinas', unit: 'unidad', cost: 900, price: 1500, iva: 21, stockMin: 20, trackExpiry: 1, rate: 2.5 },
  { code: 'LAC-001', barcode: '7790003000015', name: 'Leche Entera 1L', cat: 'Lácteos', sup: 'Lácteos La Serrana', unit: 'unidad', cost: 550, price: 900, iva: 10.5, stockMin: 60, trackExpiry: 1, rate: 10 },
  { code: 'LAC-002', barcode: '7790003000022', name: 'Yogur Bebible 1L', cat: 'Lácteos', sup: 'Lácteos La Serrana', unit: 'unidad', cost: 700, price: 1150, iva: 10.5, stockMin: 30, trackExpiry: 1, rate: 4 },
  { code: 'LAC-003', barcode: '7790003000039', name: 'Queso Cremoso 500g', cat: 'Lácteos', sup: 'Lácteos La Serrana', unit: 'unidad', cost: 2100, price: 3300, iva: 10.5, stockMin: 15, trackExpiry: 1, rate: 2 },
  { code: 'LAC-004', barcode: '7790003000046', name: 'Manteca 200g', cat: 'Lácteos', sup: 'Lácteos La Serrana', unit: 'unidad', cost: 900, price: 1450, iva: 10.5, stockMin: 20, trackExpiry: 1, rate: 3 },
  { code: 'LIM-001', barcode: '7790004000018', name: 'Detergente 750ml', cat: 'Limpieza', sup: 'Limpieza Total Mayorista', unit: 'unidad', cost: 800, price: 1350, iva: 21, stockMin: 25, trackExpiry: 0, rate: 3 },
  { code: 'LIM-002', barcode: '7790004000025', name: 'Lavandina 1L', cat: 'Limpieza', sup: 'Limpieza Total Mayorista', unit: 'unidad', cost: 500, price: 900, iva: 21, stockMin: 30, trackExpiry: 0, rate: 3.5 },
  { code: 'LIM-003', barcode: '7790004000032', name: 'Papel Higiénico x4', cat: 'Limpieza', sup: 'Limpieza Total Mayorista', unit: 'pack', cost: 1200, price: 1950, iva: 21, stockMin: 35, trackExpiry: 0, rate: 5 },
  { code: 'LIM-004', barcode: '7790004000049', name: 'Esponja de Cocina x3', cat: 'Limpieza', sup: 'Limpieza Total Mayorista', unit: 'pack', cost: 350, price: 600, iva: 21, stockMin: 20, trackExpiry: 0, rate: 2 },
  { code: 'PER-001', barcode: '7790005000011', name: 'Jabón Tocador x3', cat: 'Perfumería', sup: 'Limpieza Total Mayorista', unit: 'pack', cost: 600, price: 1000, iva: 21, stockMin: 20, trackExpiry: 0, rate: 2.5 },
  { code: 'PER-002', barcode: '7790005000028', name: 'Shampoo 400ml', cat: 'Perfumería', sup: 'Limpieza Total Mayorista', unit: 'unidad', cost: 1400, price: 2300, iva: 21, stockMin: 15, trackExpiry: 0, rate: 1.8 },
  { code: 'PER-003', barcode: '7790005000035', name: 'Pasta Dental 90g', cat: 'Perfumería', sup: 'Limpieza Total Mayorista', unit: 'unidad', cost: 700, price: 1150, iva: 21, stockMin: 20, trackExpiry: 0, rate: 2.2 },
  { code: 'SNK-001', barcode: '7790006000014', name: 'Papas Fritas 150g', cat: 'Snacks y Golosinas', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 800, price: 1350, iva: 21, stockMin: 30, trackExpiry: 1, rate: 5 },
  { code: 'SNK-002', barcode: '7790006000021', name: 'Chocolate en Barra 100g', cat: 'Snacks y Golosinas', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 600, price: 1000, iva: 21, stockMin: 40, trackExpiry: 1, rate: 6 },
  { code: 'SNK-003', barcode: '7790006000038', name: 'Galletitas Dulces 300g', cat: 'Snacks y Golosinas', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 700, price: 1150, iva: 21, stockMin: 35, trackExpiry: 1, rate: 4.5 },
  { code: 'SNK-004', barcode: '7790006000045', name: 'Caramelos Surtidos 150g', cat: 'Snacks y Golosinas', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 400, price: 700, iva: 21, stockMin: 25, trackExpiry: 1, rate: 3 },
  { code: 'CON-001', barcode: '7790007000017', name: 'Hamburguesas Congeladas x4', cat: 'Congelados', sup: 'Alimentos del Sur SRL', unit: 'pack', cost: 1800, price: 2900, iva: 21, stockMin: 15, trackExpiry: 1, rate: 2 },
  { code: 'CON-002', barcode: '7790007000024', name: 'Papas Congeladas 1kg', cat: 'Congelados', sup: 'Alimentos del Sur SRL', unit: 'unidad', cost: 1300, price: 2100, iva: 21, stockMin: 15, trackExpiry: 1, rate: 1.8 },
];

const insertProduct = db.prepare(`
  INSERT INTO products (code, barcode, name, category_id, supplier_id, unit, cost_price, sale_price, iva_rate, stock_min, stock_actual, track_expiry, active)
  VALUES (@code, @barcode, @name, @category_id, @supplier_id, @unit, @cost_price, @sale_price, @iva_rate, @stock_min, 0, @track_expiry, 1)
`);

const products = productDefs.map((p) => {
  const id = insertProduct.run({
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    category_id: categoryIds[p.cat],
    supplier_id: supplierIds[p.sup],
    unit: p.unit,
    cost_price: p.cost,
    sale_price: p.price,
    iva_rate: p.iva,
    stock_min: p.stockMin,
    track_expiry: p.trackExpiry,
  }).lastInsertRowid;
  return { ...p, id, stock: 0 };
});

// ---------------------------------------------------------------------------
// Stock inicial (compra) hace 95 dias
// ---------------------------------------------------------------------------
const insertMovement = db.prepare(`
  INSERT INTO stock_movements (product_id, warehouse_id, batch_id, type, quantity, unit_cost, reason, reference_type, reference_id, user_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Algunos productos arrancan con stock deliberadamente bajo para disparar
// sugerencias de pedido en la demo.
const lowStockCodes = new Set(['LAC-003', 'CON-001', 'PER-002', 'BEB-004', 'ALM-006']);

for (const p of products) {
  const initialQty = lowStockCodes.has(p.code)
    ? randInt(Math.round(p.stockMin * 0.6), Math.round(p.stockMin * 1.1))
    : randInt(p.stockMin * 3, p.stockMin * 5);
  p.stock = initialQty;
  insertMovement.run(p.id, whCentral, null, 'compra', initialQty, p.cost, 'Stock inicial', 'seed', null, userIds.admin, daysAgo(95, 8, 0));
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
const insertCustomer = db.prepare(
  'INSERT INTO customers (name, tax_id, phone, email, address) VALUES (?, ?, ?, ?, ?)'
);
const customers = [
  ['Consumidor Final', null, null, null, null],
  ['Restaurante El Fogón', '30-71234567-8', '011-4222-1111', 'compras@elfogon.com.ar', 'Av. Corrientes 1234'],
  ['Kiosco Don Pedro', '20-28456789-3', '011-4222-2222', 'donpedro@mail.com', 'Av. Rivadavia 5678'],
  ['Hotel Plaza', '30-70123456-1', '011-4222-3333', 'compras@hotelplaza.com.ar', 'San Martín 890'],
  ['María Fernández', '27-31234567-4', '15-4444-5555', 'maria.fernandez@mail.com', null],
  ['Comedor Escolar N°12', '30-65432109-2', '011-4222-4444', 'comedor12@edu.ar', 'Belgrano 456'],
];
const customerIds = [];
for (const c of customers) {
  customerIds.push(insertCustomer.run(...c).lastInsertRowid);
}
const consumidorFinalId = customerIds[0];

// ---------------------------------------------------------------------------
// Simulacion de 90 dias de ventas (para alimentar analitica de reposicion)
// ---------------------------------------------------------------------------
const insertSale = db.prepare(`
  INSERT INTO sales (number, customer_id, user_id, subtotal, discount_total, tax_total, total, payment_method, amount_paid, change_given, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada', ?)
`);
const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, tax_rate, subtotal)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const paymentMethods = [
  { value: 'efectivo', weight: 45 },
  { value: 'debito', weight: 25 },
  { value: 'credito', weight: 20 },
  { value: 'cheque', weight: 10 },
];

let saleCounter = 1;
console.log('Simulando 90 días de ventas...');
for (let dayOffset = 90; dayOffset >= 1; dayOffset--) {
  const numSales = randInt(8, 20);
  for (let s = 0; s < numSales; s++) {
    const hour = randInt(9, 20);
    const min = randInt(0, 59);
    const createdAt = daysAgo(dayOffset, hour, min);
    const numItems = randInt(1, 5);
    const chosen = new Set();
    const lineItems = [];
    for (let i = 0; i < numItems; i++) {
      const candidate = pickWeighted(products.map((p) => ({ ...p, weight: p.rate })));
      if (chosen.has(candidate.id)) continue;
      const availableStock = products.find((p) => p.id === candidate.id).stock;
      if (availableStock <= 0) continue;
      chosen.add(candidate.id);
      const qty = Math.min(availableStock, randInt(1, 3));
      if (qty <= 0) continue;
      lineItems.push({ product: candidate, qty });
    }
    if (lineItems.length === 0) continue;

    let subtotal = 0;
    let taxTotal = 0;
    const discountTotal = Math.random() < 0.15 ? randInt(1, 5) * 50 : 0;
    const computedItems = lineItems.map(({ product, qty }) => {
      const gross = product.price * qty;
      const net = gross / (1 + product.iva / 100);
      const tax = gross - net;
      subtotal += net;
      taxTotal += tax;
      return { product, qty, unitPrice: product.price, taxRate: product.iva, lineSubtotal: gross };
    });
    const total = Math.round((subtotal + taxTotal - discountTotal) * 100) / 100;
    const method = pickWeighted(paymentMethods).value;
    const amountPaid = method === 'efectivo' ? Math.ceil(total / 100) * 100 : total;
    const changeGiven = method === 'efectivo' ? Math.round((amountPaid - total) * 100) / 100 : 0;
    const customerId = Math.random() < 0.6 ? consumidorFinalId : pick(customerIds);
    const number = `V-${String(saleCounter).padStart(6, '0')}`;
    saleCounter++;

    const saleId = insertSale.run(
      number,
      customerId,
      pick([userIds.vendedor, userIds.gerente, userIds.admin]),
      Math.round(subtotal * 100) / 100,
      discountTotal,
      Math.round(taxTotal * 100) / 100,
      total,
      method,
      amountPaid,
      changeGiven,
      createdAt
    ).lastInsertRowid;

    for (const item of computedItems) {
      insertSaleItem.run(saleId, item.product.id, item.qty, item.unitPrice, 0, item.taxRate, Math.round(item.lineSubtotal * 100) / 100);
      insertMovement.run(item.product.id, whCentral, null, 'venta', -item.qty, null, null, 'sale', saleId, userIds.vendedor, createdAt);
      const prod = products.find((p) => p.id === item.product.id);
      prod.stock -= item.qty;
    }
  }

  // Reposicion semanal: simula pedidos periodicos a proveedores para que el
  // stock final sea realista. Los productos marcados como "lowStockCodes" no
  // se reponen a proposito, para que queden por debajo del minimo y disparen
  // sugerencias de pedido en la demo.
  if (dayOffset % 7 === 0) {
    for (const p of products) {
      if (lowStockCodes.has(p.code)) continue;
      if (p.stock < p.stockMin * 2) {
        const targetStock = p.stockMin * randInt(4, 6);
        const qty = Math.max(0, Math.round(targetStock - p.stock));
        if (qty > 0) {
          insertMovement.run(p.id, whCentral, null, 'compra', qty, p.cost, 'Reposición periódica de proveedor', 'seed', null, userIds.admin, daysAgo(dayOffset, 8, 0));
          p.stock += qty;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ajuste manual y perdida de ejemplo (para poblar historial de movimientos)
// ---------------------------------------------------------------------------
const sampleAdjustProduct = products.find((p) => p.code === 'ALM-002');
insertMovement.run(sampleAdjustProduct.id, whCentral, null, 'ajuste_negativo', -3, null, 'Diferencia detectada en conteo físico mensual', 'manual', null, userIds.gerente, daysAgo(4, 16, 0));
sampleAdjustProduct.stock -= 3;

const sampleLossProduct = products.find((p) => p.code === 'LIM-003');
insertMovement.run(sampleLossProduct.id, whCentral, null, 'perdida', -2, null, 'Paquetes dañados por humedad en depósito', 'manual', null, userIds.gerente, daysAgo(10, 11, 30));
sampleLossProduct.stock -= 2;

// ---------------------------------------------------------------------------
// Lotes con vencimiento para productos que trackean vencimiento
// ---------------------------------------------------------------------------
const insertBatch = db.prepare(`
  INSERT INTO product_batches (product_id, warehouse_id, batch_code, quantity, expiry_date, received_at, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
`);

// Distribucion de vencimientos: [fraccion, dias desde hoy (negativo=vencido)]
const expiryProfile = [
  { frac: 0.10, days: -5 },   // ya vencido
  { frac: 0.15, days: 5 },    // vence en 5 dias
  { frac: 0.20, days: 15 },   // vence en 15 dias
  { frac: 0.20, days: 27 },   // vence en 27 dias
  { frac: 0.35, days: 75 },   // vencimiento lejano
];

let batchSeq = 1;
for (const p of products) {
  if (!p.trackExpiry) continue;
  const totalStock = Math.max(0, Math.round(p.stock));
  if (totalStock === 0) {
    insertBatch.run(p.id, whCentral, `L${String(batchSeq++).padStart(5, '0')}`, 0, daysFromNow(60), daysAgo(30, 9, 0));
    continue;
  }
  let remaining = totalStock;
  expiryProfile.forEach((profile, idx) => {
    const isLast = idx === expiryProfile.length - 1;
    const qty = isLast ? remaining : Math.round(totalStock * profile.frac);
    if (qty <= 0) return;
    remaining -= qty;
    const receivedDaysAgo = profile.days < 0 ? 95 : Math.min(90, 90 - profile.days);
    insertBatch.run(
      p.id,
      whCentral,
      `L${String(batchSeq++).padStart(5, '0')}`,
      qty,
      daysFromNow(profile.days),
      daysAgo(Math.max(receivedDaysAgo, 1), 9, 0)
    );
  });
}

// ---------------------------------------------------------------------------
// Guardar stock final calculado en products.stock_actual
// ---------------------------------------------------------------------------
const updateStock = db.prepare('UPDATE products SET stock_actual = ? WHERE id = ?');
for (const p of products) {
  updateStock.run(Math.max(0, Math.round(p.stock * 100) / 100), p.id);
}

// ---------------------------------------------------------------------------
// Auditoria de ejemplo
// ---------------------------------------------------------------------------
const insertAudit = db.prepare(
  'INSERT INTO audit_log (user_id, username, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
insertAudit.run(userIds.admin, 'admin', 'seed', 'system', null, 'Carga inicial de datos de ejemplo', daysAgo(95, 7, 0));

console.log(`Listo. Usuarios: admin/admin123, gerente/gerente123, vendedor/vendedor123`);
console.log(`Productos cargados: ${products.length}. Ventas simuladas: ${saleCounter - 1}.`);
