const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');

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
              s.barcode_enabled
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

    // Block login if subscription is expired
    if (user.subscription_status === 'expired' || user.subscription_status === 'suspended') {
      return res.status(403).json({ error: 'Subscription expired. Please contact support.' });
    }

    const token = jwt.sign(
      {
        id:       user.id,
        shop_id:  user.shop_id,
        role:     user.role,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      user: {
        id:                   user.id,
        username:             user.username,
        role:                 user.role,
        shop_id:              user.shop_id,
        shop_name:            user.shop_name,
        subscription_status:  user.subscription_status,
        subscription_end_date: user.subscription_end_date,
        barcode_enabled:      user.barcode_enabled,
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
              s.barcode_enabled
         FROM users u
         JOIN shops s ON s.id = u.shop_id
        WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
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

module.exports = { login, registerUser, getMe, listUsers, deleteUser };
