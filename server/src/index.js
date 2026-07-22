require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

require('./db/connection'); // asegura que la base de datos y el schema existan

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { scheduleBackups } = require('./services/backupService');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/suppliers', require('./routes/suppliers.routes'));
app.use('/api/stock', require('./routes/stock.routes'));
app.use('/api/batches', require('./routes/batches.routes'));
app.use('/api/sales', require('./routes/sales.routes'));
app.use('/api/customers', require('./routes/customers.routes'));
app.use('/api/reorder', require('./routes/reorder.routes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/backup', require('./routes/backup.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Sirve el build de produccion del cliente (Vite) si existe.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

scheduleBackups();

app.listen(PORT, () => {
  console.log(`ERP/POS server escuchando en http://localhost:${PORT}`);
});
