const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');

const GRACE_DAYS = 5;

// Returns { readOnly, inGracePeriod, graceDaysRemaining, daysUntilExpiry }
function calcSubscriptionFlags(subscriptionStatus, subscriptionEndDate) {
  let readOnly = false;
  let inGracePeriod = false;
  let graceDaysRemaining = 0;
  let daysUntilExpiry = null;

  if (subscriptionEndDate) {
    const msPerDay    = 86_400_000;
    const daysOverdue = (Date.now() - new Date(subscriptionEndDate).getTime()) / msPerDay;
    daysUntilExpiry   = -daysOverdue; // positive = days left, negative = overdue

    if (daysOverdue > GRACE_DAYS) {
      readOnly = true;
    } else if (daysOverdue > 0) {
      inGracePeriod      = true;
      graceDaysRemaining = Math.ceil(GRACE_DAYS - daysOverdue);
    }
  } else if (subscriptionStatus === 'expired') {
    readOnly = true; // no end_date + expired status → fully locked
  }

  return { readOnly, inGracePeriod, graceDaysRemaining, daysUntilExpiry };
}

// ── POST /api/auth/login ──────────────────────────────────────
async function login(req, res) {
  const { username, password, shop_id } = req.body;

  if (!username || !password || !shop_id) {
    return res.status(400).json({ error: 'username, password and shop_id are required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.password_hash, u.role, u.shop_id,
              s.name AS shop_name, s.subscription_status, s.subscription_end_date,
              s.barcode_enabled, COALESCE(s.default_tax_rate, 0) AS default_tax_rate,
              COALESCE(s.shop_type, 'retail') AS shop_type
         FROM users u
         JOIN shops s ON s.id = u.shop_id
        WHERE u.username = $1 AND u.shop_id = $2`,
      [username, shop_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
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

    const sub = calcSubscriptionFlags(user.subscription_status, user.subscription_end_date);

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
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      user: {
        id:                    user.id,
        username:              user.username,
        role:                  user.role,
        shop_id:               user.shop_id,
        shop_name:             user.shop_name,
        subscription_status:   user.subscription_status,
        subscription_end_date: user.subscription_end_date,
        barcode_enabled:       user.barcode_enabled,
        default_tax_rate:      parseFloat(user.default_tax_rate) || 0,
        shop_type:             user.shop_type || 'retail',
        read_only:             sub.readOnly,
        in_grace_period:       sub.inGracePeriod,
        grace_days_remaining:  sub.graceDaysRemaining,
        days_until_expiry:     sub.daysUntilExpiry,
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
      `SELECT u.id, u.username, u.role, u.shop_id, u.created_at,
              s.name AS shop_name, s.subscription_status, s.subscription_end_date,
              s.barcode_enabled, COALESCE(s.default_tax_rate, 0) AS default_tax_rate,
              COALESCE(s.shop_type, 'retail') AS shop_type
         FROM users u
         JOIN shops s ON s.id = u.shop_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row = rows[0];
    const sub = calcSubscriptionFlags(row.subscription_status, row.subscription_end_date);
    res.json({
      ...row,
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
