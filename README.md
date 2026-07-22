# ERP / Punto de Venta

Sistema completo de gestión comercial para un punto de venta: control de stock,
vencimientos, sugerencia de pedidos por demanda y venta interna (POS). Aplicación
web full-stack lista para producción, pensada para un comercio real (almacén,
kiosco, distribuidora chica/mediana).

- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Frontend:** React + Vite (sin frameworks CSS pesados, CSS propio con variables
  para tema claro/oscuro)
- **Auth:** JWT + bcrypt, roles Admin / Gerente / Vendedor
- **Base de datos:** SQLite, un solo archivo (`server/data/erp.db`), con respaldo
  automático diario

---

## 1. Instalación

Requisitos: Node.js 18 o superior.

```bash
npm run install:all
```

Esto instala las dependencias del backend (`server/`) y del frontend (`client/`).

## 2. Cargar datos de ejemplo

```bash
npm run seed
```

Crea el esquema de base de datos (si no existe) y lo puebla con:

- 3 usuarios (`admin/admin123`, `gerente/gerente123`, `vendedor/vendedor123`)
- 7 categorías, 5 proveedores, 27 productos (algunos con control de vencimiento)
- 90 días de ventas simuladas (para que los reportes y las sugerencias de pedido
  tengan datos reales para analizar)
- Lotes con vencimientos escalonados (vencidos, por vencer en 5/15/27 días, y
  lejanos) para poder probar las alertas de inmediato
- Clientes de ejemplo

Podés volver a correr `npm run seed` las veces que quieras: borra y recarga todo.

## 3. Ejecutar

### Modo producción (un solo comando)

```bash
npm start
```

Compila el frontend y levanta el backend en `http://localhost:4000`, sirviendo
también los archivos estáticos del cliente (un solo proceso, un solo puerto).

### Modo desarrollo (hot reload)

```bash
npm run dev
```

Levanta el backend con `nodemon` en `:4000` y el frontend con Vite en `:5173`
(con proxy automático de `/api` hacia el backend).

Abrí `http://localhost:5173` (desarrollo) o `http://localhost:4000` (producción)
e ingresá con cualquiera de los usuarios de prueba.

---

## 4. Funcionalidades

### Control de stock
- Inventario en tiempo real por producto, con histórico completo de movimientos
  (compras, ventas, ajustes, pérdidas, descartes, devoluciones).
- Alertas automáticas cuando el stock cae por debajo del mínimo configurado por
  producto.
- Ajustes manuales con justificación obligatoria (auditados).
- Registro de entrada de mercadería (compras/devoluciones), con costo y lote.

### Control de vencimientos
- Cada producto puede marcarse para llevar control de vencimiento por lote
  (`track_expiry`). El stock de esos productos se compone de lotes con fecha de
  vencimiento propia.
- Alertas de "próximos a vencer" configurables (por defecto 30/15/7 días).
- Listado de vencidos, con acción de descarte (genera movimiento de stock y
  registra motivo/usuario/fecha).
- **La venta de stock vencido está bloqueada automáticamente**: el sistema
  consume stock por FIFO de vencimiento y nunca vende de un lote vencido; si
  sólo queda stock vencido, la venta se rechaza con un mensaje claro.
- Historial completo de descartes.

### Sugerencia de pedidos por demanda
- Analiza el historial real de ventas (ventana configurable: 30/60/90 días) por
  producto.
- Calcula punto de reorden y cantidad sugerida usando:
  velocidad de rotación (venta promedio diaria), lead time del proveedor,
  variabilidad de la demanda (desvío estándar) y un stock de seguridad
  (`z * σ * √lead_time`).
- Dashboard "Pedidos Sugeridos" agrupado por proveedor, con cantidades
  editables antes de generar la orden de compra.
- Órdenes de compra con recepción (parcial o total), que actualizan stock y
  crean los lotes de vencimiento correspondientes automáticamente.
- Historial de sugerencias generadas.

### Punto de Venta (POS)
- Búsqueda de productos por código, nombre o código de barras.
- Carrito editable (cantidad, descuento por línea, descuento total).
- Cálculo automático de IVA (configurable por producto) y totales.
- Métodos de pago: efectivo (con vuelto automático), débito, crédito, cheque.
- Comprobante imprimible (ticket) al confirmar la venta.
- Historial de transacciones con anulación (repone stock automáticamente).
- Reportes de ventas por período, por producto y por categoría, exportables a
  CSV.

### Seguridad y auditoría
- Login con JWT, contraseñas con bcrypt.
- Roles: **Admin** (todo), **Gerente** (todo excepto usuarios/configuración),
  **Vendedor** (POS, consulta de stock/vencimientos/clientes).
- Auditoría de operaciones críticas (ventas, ajustes de stock, descartes,
  altas/bajas de productos, cambios de configuración, etc.).
- Respaldo automático diario de la base de datos (03:00, se conservan los
  últimos 30) y botón de respaldo manual en Configuración.

---

## 5. Estructura del proyecto

```
ERP/
├── server/                 Backend Express + SQLite
│   ├── src/
│   │   ├── db/              schema.sql, connection.js, seed.js
│   │   ├── middleware/       auth, manejo de errores
│   │   ├── routes/           un archivo por recurso REST
│   │   ├── services/         lógica de negocio (stock, ventas, reposición...)
│   │   └── index.js          punto de entrada
│   └── data/                erp.db + backups/ (se genera en runtime)
├── client/                 Frontend React + Vite
│   └── src/
│       ├── pages/            una página por sección del menú
│       ├── components/       Layout, Modal, ProtectedRoute
│       ├── context/           Auth, Theme, Toast
│       └── api/               cliente axios
└── package.json             scripts orquestadores (install:all, dev, start, seed)
```

## 6. Modelo de datos (resumen)

`products` (con `stock_min`, `stock_actual`, `track_expiry`, `iva_rate`) ·
`product_batches` (lotes con `expiry_date`) · `stock_movements` (auditoría de
todo movimiento) · `sales` / `sale_items` · `customers` · `suppliers` ·
`purchase_orders` / `purchase_order_items` · `reorder_suggestions` ·
`categories` · `users` · `audit_log` · `settings`.

El esquema completo está en [`server/src/db/schema.sql`](server/src/db/schema.sql).

## 7. API

Todas las rutas viven bajo `/api` y requieren `Authorization: Bearer <token>`
(excepto `/api/auth/login`). Resumen:

| Recurso | Rutas principales |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Productos | `GET/POST/PUT/DELETE /products`, `GET /products/:id/batches`, `GET /products/:id/movements` |
| Categorías / Proveedores | `GET/POST/PUT/DELETE /categories`, `/suppliers` |
| Stock | `GET /stock/movements`, `POST /stock/entry`, `/adjustment`, `/loss` |
| Vencimientos | `GET /batches/near-expiry`, `/expired`, `/discarded`, `POST /batches/:id/discard` |
| Ventas (POS) | `GET/POST /sales`, `POST /sales/:id/void`, `GET /sales/today-summary` |
| Clientes | `GET/POST/PUT/DELETE /customers`, `GET /customers/:id/history` |
| Reposición | `GET /reorder/suggestions`, `POST /reorder/snapshot`, `GET /reorder/history` |
| Órdenes de compra | `GET/POST /purchase-orders`, `POST /purchase-orders/:id/receive` |
| Reportes | `GET /reports/sales(.csv)`, `/inventory(.csv)`, `/movements.csv` |
| Dashboard | `GET /dashboard/kpis` |
| Configuración | `GET/PUT /settings` |
| Usuarios | `GET/POST/PUT /users` (solo admin) |
| Auditoría | `GET /audit` (admin/gerente) |
| Backup | `POST /backup` (admin) |

## 8. Notas de producción

- Cambiá `JWT_SECRET` en `server/.env` antes de exponer el sistema fuera de tu
  red local (copiá `server/.env.example` a `server/.env`).
- La base de datos es un único archivo SQLite; para un volumen alto de
  transacciones concurrentes considerá migrar a PostgreSQL (el esquema es
  estándar SQL y portable).
- Los respaldos se guardan en `server/data/backups/`; asegurate de incluir esa
  carpeta (o el archivo `erp.db`) en tu estrategia de backup externo.
