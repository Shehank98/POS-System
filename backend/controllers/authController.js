const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');

// Returns { readOnly, inGracePeriod, graceDaysRemaining, daysUntilExpiry }
function calcSubscriptionFlags(subscriptionStatus, subscriptionEndDate, gracePeriodDays = 5) {
  const GRACE = parseInt(gracePeriodDays, 10) || 5;
  let readOnly = false;
  let inGracePeriod = false;
  let graceDaysRemaining = 0;
  let daysUntilExpiry = null;

  if (subscriptionEndDate) {
    const msPerDay    = 86_400_000;
    const daysOverdue = (Date.now() - new Date(subscriptionEndDate).getTime()) / msPerDay;
    daysUntilExpiry   = -daysOverdue; // positive = days left, negative = overdue

    if (daysOverdue > GRACE) {
      readOnly = true;
    } else if (daysOverdue > 0) {
      inGracePeriod      = true;
      graceDaysRemaining = Math.ceil(GRACE - daysOverdue);
    }
  } else if (subscriptionStatus === 'expired') {
    readOnly = true; // no end_date + expired status → fully locked
  }

  return { readOnly, inGracePeriod, graceDaysRemaining, daysUntilExpiry };
}

// ── Shared column list for login / getMe queries ──────────────
const USER_SHOP_COLS = `
  u.id, u.username, u.email AS user_email, u.password_hash, u.role, u.shop_id,
  s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone,
  COALESCE(s.contact_email, s.email, '') AS shop_email,
  s.subscription_status, s.subscription_end_date,
  s.barcode_enabled, COALESCE(s.default_tax_rate, 0) AS default_tax_rate,
  COALESCE(s.shop_type, 'retail') AS shop_type,
  COALESCE(s.pre_orders_enabled, TRUE)  AS pre_orders_enabled,
  COALESCE(s.customers_enabled,  TRUE)  AS customers_enabled,
  COALESCE(s.reports_enabled,    TRUE)  AS reports_enabled,
  COALESCE(s.analytics_enabled,  TRUE)  AS analytics_enabled,
  COALESCE(s.loyalty_enabled,    TRUE)  AS loyalty_enabled,
  COALESCE(s.refunds_enabled,    TRUE)  AS refunds_enabled,
  COALESCE(s.void_enabled,       TRUE)  AS void_enabled,
  COALESCE(s.offline_enabled,    TRUE)  AS offline_enabled,
  COALESCE(s.exchanges_enabled,             TRUE)  AS exchanges_enabled,
  COALESCE(s.branches_enabled,             TRUE)  AS branches_enabled,
  COALESCE(s.car_service_products_enabled, TRUE)  AS car_service_products_enabled,
  COALESCE(s.grace_period_days,            5)     AS grace_period_days
`;

// Records a login session for security tracking (best-effort, non-blocking)
async function recordLoginSession(userId, role, req) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.socket?.remoteAddress
               || null;
    const deviceInfo = req.headers['user-agent'] || null;
    await db.query(
      `INSERT INTO login_sessions (user_id, role, device_info, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, role, deviceInfo, ip]
    );
  } catch (_) { /* non-fatal */ }
}

// ── POST /api/auth/login ──────────────────────────────────────
// Accepts { identifier, password } — identifier is email or username.
// Backward-compat: also accepts { username, password, shop_id } from legacy clients.
async function login(req, res) {
  // Support both new (identifier) and legacy (username + shop_id) payloads
  const identifier = (req.body.identifier || req.body.username || '').trim();
  const password   = (req.body.password || '').trim();
  const shopIdHint = req.body.shop_id; // optional, used to disambiguate usernames

  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' });
  }

  try {
    const isEmail = identifier.includes('@');
    let rows;

    if (isEmail) {
      // ── Email lookup (globally unique) ─────────────────────
      // 1. Check users.email column (added in migration 025)
      // 2. Fall back to matching shop owner via shops.email / shops.contact_email
      const emailLower = identifier.toLowerCase();
      const result = await db.query(
        `SELECT ${USER_SHOP_COLS}
           FROM users u
           JOIN shops s ON s.id = u.shop_id
          WHERE LOWER(COALESCE(u.email, '')) = $1
          LIMIT 2`,
        [emailLower]
      );
      rows = result.rows;

      // Fallback: find owner by shop email when users.email is not yet populated
      if (rows.length === 0) {
        const fallback = await db.query(
          `SELECT ${USER_SHOP_COLS}
             FROM users u
             JOIN shops s ON s.id = u.shop_id
            WHERE u.role = 'owner'
              AND (LOWER(COALESCE(s.contact_email, '')) = $1
                   OR LOWER(COALESCE(s.email, '')) = $1)
            LIMIT 2`,
          [emailLower]
        );
        rows = fallback.rows;
      }

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (rows.length > 1) {
        // Two accounts share the same email — should not happen in clean data
        return res.status(409).json({ error: 'Multiple accounts share this email. Please contact support.' });
      }
    } else {
      // ── Username lookup ────────────────────────────────────
      // If shop_id is provided (legacy clients), narrow by it.
      // Otherwise look globally; if ambiguous, ask user to log in with email.
      if (shopIdHint) {
        const result = await db.query(
          `SELECT ${USER_SHOP_COLS}
             FROM users u
             JOIN shops s ON s.id = u.shop_id
            WHERE u.username = $1 AND u.shop_id = $2
            LIMIT 1`,
          [identifier, shopIdHint]
        );
        rows = result.rows;
      } else {
        const result = await db.query(
          `SELECT ${USER_SHOP_COLS}
             FROM users u
             JOIN shops s ON s.id = u.shop_id
            WHERE u.username = $1
            LIMIT 2`,
          [identifier]
        );
        rows = result.rows;
        if (rows.length > 1) {
          return res.status(409).json({
            error: 'This username exists in multiple shops. Please log in with your email address instead.',
          });
        }
      }

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Hard block: suspended shops cannot log in at all
    if (user.subscription_status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Please contact support.' });
    }

    const sub = calcSubscriptionFlags(user.subscription_status, user.subscription_end_date, user.grace_period_days);

    const iat = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        id:              user.id,
        shop_id:         user.shop_id,
        role:            user.role,
        username:        user.username,
        barcode_enabled: user.barcode_enabled,
        shop_type:       user.shop_type || 'retail',
        read_only:       sub.readOnly,
        in_grace_period: sub.inGracePeriod,
        iat,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    // Record session (non-blocking)
    recordLoginSession(user.id, user.role, req);

    res.json({
      token,
      user: {
        id:                    user.id,
        username:              user.username,
        email:                 user.user_email || null,
        role:                  user.role,
        shop_id:               user.shop_id,
        shop_name:             user.shop_name,
        shop_address:          user.shop_address || '',
        shop_phone:            user.shop_phone   || '',
        shop_email:            user.shop_email   || '',
        subscription_status:   user.subscription_status,
        subscription_end_date: user.subscription_end_date,
        barcode_enabled:       user.barcode_enabled,
        default_tax_rate:      parseFloat(user.default_tax_rate) || 0,
        shop_type:             user.shop_type || 'retail',
        read_only:             sub.readOnly,
        in_grace_period:       sub.inGracePeriod,
        grace_days_remaining:  sub.graceDaysRemaining,
        days_until_expiry:     sub.daysUntilExpiry,
        // Feature flags
        pre_orders_enabled:    user.pre_orders_enabled,
        customers_enabled:     user.customers_enabled,
        reports_enabled:       user.reports_enabled,
        analytics_enabled:     user.analytics_enabled,
        loyalty_enabled:       user.loyalty_enabled,
        refunds_enabled:       user.refunds_enabled,
        void_enabled:          user.void_enabled,
        offline_enabled:       user.offline_enabled,
        exchanges_enabled:              user.exchanges_enabled,
        branches_enabled:               user.branches_enabled,
        car_service_products_enabled:   user.car_service_products_enabled,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
}

// ── POST /api/auth/register-user ─────────────────────────────
// Owner or manager creates a new staff account for their shop
async function registerUser(req, res) {
  const { username, password, role } = req.body;
  const shop_id = req.shopId;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const allowedRoles = ['manager', 'cashier'];
  const assignedRole = allowedRoles.includes(role) ? role : 'cashier';

  try {
    // Only owners and managers can add cashiers; only owners can add managers
    if (assignedRole === 'manager' && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can create manager accounts' });
    }

    // ── Staff limit: default 1 manager + 1 cashier per shop ───
    // Admin can increase by setting extra_staff_slots on the shop.
    let extraSlots = 0;
    try {
      const slotRes = await db.query(
        `SELECT COALESCE(extra_staff_slots, 0) AS extra_staff_slots FROM shops WHERE id = $1`,
        [shop_id]
      );
      extraSlots = parseInt(slotRes.rows[0]?.extra_staff_slots, 10) || 0;
    } catch { /* column may not exist yet - use default 0 */ }

    const maxPerRole = 1 + extraSlots;
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE shop_id = $1 AND role = $2`,
      [shop_id, assignedRole]
    );
    const current = parseInt(countRes.rows[0].cnt, 10);
    if (current >= maxPerRole) {
      return res.status(403).json({
        error: `${assignedRole === 'manager' ? 'Manager' : 'Cashier'} limit reached (max ${maxPerRole}). Contact admin to add more staff slots.`,
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (shop_id, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, created_at`,
      [shop_id, username, hash, assignedRole]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists in this shop' });
    }
    console.error('register-user error:', err);
    res.status(500).json({ error: 'Server error creating user' });
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────
async function getMe(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.email AS user_email, u.role, u.shop_id, u.created_at,
              s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone,
              COALESCE(s.contact_email, s.email, '') AS shop_email,
              s.subscription_status, s.subscription_end_date,
              s.barcode_enabled, COALESCE(s.default_tax_rate, 0) AS default_tax_rate,
              COALESCE(s.shop_type, 'retail') AS shop_type,
              COALESCE(s.pre_orders_enabled, TRUE)  AS pre_orders_enabled,
              COALESCE(s.customers_enabled,  TRUE)  AS customers_enabled,
              COALESCE(s.reports_enabled,    TRUE)  AS reports_enabled,
              COALESCE(s.analytics_enabled,  TRUE)  AS analytics_enabled,
              COALESCE(s.loyalty_enabled,    TRUE)  AS loyalty_enabled,
              COALESCE(s.refunds_enabled,    TRUE)  AS refunds_enabled,
              COALESCE(s.void_enabled,       TRUE)  AS void_enabled,
              COALESCE(s.offline_enabled,    TRUE)  AS offline_enabled,
              COALESCE(s.exchanges_enabled,             TRUE)  AS exchanges_enabled,
              COALESCE(s.branches_enabled,             TRUE)  AS branches_enabled,
              COALESCE(s.car_service_products_enabled, TRUE)  AS car_service_products_enabled,
              COALESCE(s.grace_period_days,            5)     AS grace_period_days
         FROM users u
         JOIN shops s ON s.id = u.shop_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row = rows[0];
    const sub = calcSubscriptionFlags(row.subscription_status, row.subscription_end_date, row.grace_period_days);
    res.json({
      ...row,
      email:                row.user_email || null,
      read_only:            sub.readOnly,
      in_grace_period:      sub.inGracePeriod,
      grace_days_remaining: sub.graceDaysRemaining,
      days_until_expiry:    sub.daysUntilExpiry,
    });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/auth/users ─────────────────────────────────────
// List all staff in the shop (owner/manager only)
async function listUsers(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, username, role, created_at
         FROM users
        WHERE shop_id = $1
        ORDER BY created_at ASC`,
      [req.shopId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/auth/users/:id ────────────────────────────────
async function deleteUser(req, res) {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const { rowCount } = await db.query(
      `DELETE FROM users WHERE id = $1 AND shop_id = $2`,
      [targetId, req.shopId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/settings ────────────────────────────────────────
// Shop owner updates shop-level settings (default tax rate, etc.)
async function updateSettings(req, res) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owners can update shop settings' });
  }
  const { default_tax_rate } = req.body;
  const rate = parseFloat(default_tax_rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ error: 'default_tax_rate must be between 0 and 100' });
  }
  try {
    await db.query(
      `UPDATE shops SET default_tax_rate = $1 WHERE id = $2`,
      [rate, req.shopId]
    );
    res.json({ default_tax_rate: rate });
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { login, registerUser, getMe, listUsers, deleteUser, updateSettings };
