require('dotenv').config();
const http           = require('http');
const express        = require('express');
const cors           = require('cors');
const cron           = require('node-cron');
const path           = require('path');
const { setupWebSocket } = require('./websocket');
const runMigrations  = require('./utils/runMigrations');

const authRoutes         = require('./routes/auth');
const productRoutes      = require('./routes/products');
const transactionRoutes  = require('./routes/transactions');
const adminRoutes        = require('./routes/admin');
const dashboardRoutes    = require('./routes/dashboard');
const reportRoutes       = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes      = require('./routes/payments');
const auditRoutes        = require('./routes/audit');
const preOrderRoutes     = require('./routes/preOrders');
const customerRoutes     = require('./routes/customers');
const carwashRoutes      = require('./routes/carwash');
const carwashPublicRoutes = require('./routes/carwashPublic');

const { runDailyChecks }        = require('./controllers/notificationController');
const { cancelStalePreOrders }  = require('./controllers/preOrderController');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '5mb' })); // allow base64 payment proof images

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/products',      productRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/audit-log',     auditRoutes);
app.use('/api/pre-orders',    preOrderRoutes);
app.use('/api/customers',     customerRoutes);
// Car Wash module — public routes BEFORE authenticated to avoid JWT guard
app.use('/api/carwash/public', carwashPublicRoutes);
app.use('/api/carwash',        carwashRoutes);

// ── Serve React frontend in production ────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  // All non-API routes return the SPA entry point
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── 404 handler (API only in production) ─────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Cron: daily checks at 09:00 server time ───────────────────
cron.schedule('0 9 * * *', runDailyChecks);
console.log('[Cron] Daily check scheduled at 09:00');

// ── Cron: cancel stale pre-orders every 30 minutes ────────────
cron.schedule('*/30 * * * *', cancelStalePreOrders);
console.log('[Cron] Stale pre-order cleanup scheduled every 30 minutes');

// ── Start: apply pending DB migrations, then listen ──────────
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
setupWebSocket(server);

runMigrations()
  .catch((err) => console.error('[Migration] Runner error (non-fatal):', err.message))
  .finally(() => {
    server.listen(PORT, () => console.log(`POS API running on port ${PORT}`));
  });
