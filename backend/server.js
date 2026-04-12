require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');

const authRoutes         = require('./routes/auth');
const productRoutes      = require('./routes/products');
const transactionRoutes  = require('./routes/transactions');
const adminRoutes        = require('./routes/admin');
const dashboardRoutes    = require('./routes/dashboard');
const reportRoutes       = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes      = require('./routes/payments');

const { runDailyChecks } = require('./controllers/notificationController');

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

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Cron: daily checks at 09:00 server time ───────────────────
cron.schedule('0 9 * * *', runDailyChecks);
console.log('[Cron] Daily check scheduled at 09:00');

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`POS API running on port ${PORT}`));
