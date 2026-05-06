require('dotenv').config();

// ── Startup environment validation ───────────────────────────
const _required = ['JWT_SECRET', 'DATABASE_URL'];
const _missing  = _required.filter((k) => !process.env[k]);
if (_missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${_missing.join(', ')}`);
  process.exit(1);
}

const http           = require('http');
const express        = require('express');
const cors           = require('cors');
const cron           = require('node-cron');
const path           = require('path');
const { setupWebSocket } = require('./websocket');
const runMigrations  = require('./utils/runMigrations');

const authRoutes         = require('./routes/auth');
const agentAuthRoutes    = require('./routes/agentAuth');
const agentRoutes        = require('./routes/agents');
const productRoutes      = require('./routes/products');
const transactionRoutes  = require('./routes/transactions');
const adminRoutes        = require('./routes/admin');
const dashboardRoutes    = require('./routes/dashboard');
const reportRoutes       = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes      = require('./routes/payments');
const auditRoutes        = require('./routes/audit');
const preOrderRoutes     = require('./routes/preOrders');
const customerRoutes      = require('./routes/customers');
const emailSummaryRoutes  = require('./routes/emailSummary');
const carwashRoutes       = require('./routes/carwash');
const carwashPublicRoutes = require('./routes/carwashPublic');
const clothingRoutes      = require('./routes/clothing');
const qrPaymentRoutes     = require('./routes/qrPayments');
const shopPaymentRoutes   = require('./routes/shopPayments');
const webhookRoutes       = require('./routes/webhooks');

const { runDailyChecks }        = require('./controllers/notificationController');
const { cancelStalePreOrders }  = require('./controllers/preOrderController');
const activationGuard           = require('./middleware/activationGuard');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Capture raw body for webhook HMAC verification BEFORE express.json parses it.
// Only applies to the /api/webhooks prefix to avoid memory cost on large uploads.
app.use('/api/webhooks', (req, _res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { data += chunk; });
  req.on('end',  () => {
    req.rawBody = data;
    try { req.body = JSON.parse(data || '{}'); } catch { req.body = {}; }
    req._body = true; // tell body-parser/express.json to skip — stream already consumed
    next();
  });
});

app.use(express.json({ limit: '20mb' })); // allow base64 document uploads (registration flow)

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Webhook routes (public, before activation guard) ─────────
app.use('/api/webhooks', webhookRoutes);

// ── Activation guard (blocks inactive shop accounts from non-billing routes) ──
app.use(activationGuard);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/agent-auth',    agentAuthRoutes);
app.use('/api/agents',        agentRoutes);
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
app.use('/api/email-summary', emailSummaryRoutes);
// Car Wash module — public routes BEFORE authenticated to avoid JWT guard
app.use('/api/carwash/public', carwashPublicRoutes);
app.use('/api/carwash',        carwashRoutes);
// Clothing module
app.use('/api/clothing',       clothingRoutes);
// QR Payments (HelaPOS / LankaQR)
app.use('/api/qr',             qrPaymentRoutes);
// Shop payment proofs (shop owner uploads, admin verifies)
app.use('/api/shop-payments',  shopPaymentRoutes);
// Webhook logs viewer (admin) — route already mounted above for public POST

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
