const jwt = require('jsonwebtoken');
const db  = require('../config/database');

// Paths that inactive shop accounts can still access
const EXEMPT_PREFIXES = [
  '/api/auth',          // login, /me, user management
  '/api/shop-payments', // billing: upload proof, view status
  '/api/payments',      // billing: subscription payment history
  '/api/admin',         // admin panel (different auth)
  '/api/agent',         // agent portal (different auth)
  '/api/qr',            // public QR display pages
  '/api/carwash/public',// public car-wash customer portal
  '/health',
];

async function activationGuard(req, res, next) {
  // Skip exempt paths
  if (EXEMPT_PREFIXES.some((p) => req.originalUrl.startsWith(p))) {
    return next();
  }

  // Extract JWT — same logic as authMiddleware
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  // No token → let authMiddleware handle the 401
  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(); // invalid token → authMiddleware will reject it properly
  }

  // Only applies to shop users (not admin / agent tokens)
  if (!decoded.shop_id) return next();

  try {
    const { rows } = await db.query(
      'SELECT activation_status FROM shops WHERE id = $1',
      [decoded.shop_id]
    );
    const status = rows[0]?.activation_status ?? 'active';
    if (status !== 'active') {
      return res.status(403).json({
        error: 'Account not activated. Complete payment to access this feature.',
        code: 'ACCOUNT_INACTIVE',
      });
    }
  } catch {
    // Fail-open: don't block users if DB check fails
  }

  next();
}

module.exports = activationGuard;
