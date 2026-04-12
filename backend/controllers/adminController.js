const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');

// ── POST /api/admin/login ─────────────────────────────────────
async function adminLogin(req, res) {
  const { email, password } = req.body;

  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@pos.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123!';

  if (email !== adminEmail) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const valid = await bcrypt.compare(password, adminPassword).catch(() => false);
  // Also support plain-text comparison during development when ADMIN_PASSWORD is not hashed
  const plainMatch = password === adminPassword;

  if (!valid && !plainMatch) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ role: 'superadmin', email }, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });

  res.json({ token });
}

// ── GET /api/admin/dashboard ──────────────────────────────────
async function getDashboard(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM shops)                                           AS total_shops,
        (SELECT COUNT(*) FROM shops WHERE subscription_status = 'active')     AS active_shops,
        (SELECT COUNT(*) FROM shops WHERE subscription_status = 'trial')      AS trial_shops,
        (SELECT COUNT(*) FROM shops WHERE subscription_status = 'expired')    AS expired_shops,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified') AS total_revenue,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending')              AS pending_payments
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops ──────────────────────────────────────
async function listShops(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT s.*,
             COUNT(u.id)                        AS user_count,
             COUNT(p.id)                        AS product_count,
             COUNT(t.id)                        AS transaction_count
        FROM shops s
        LEFT JOIN users u        ON u.shop_id = s.id
        LEFT JOIN products p     ON p.shop_id = s.id
        LEFT JOIN transactions t ON t.shop_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listShops error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/admin/shops ─────────────────────────────────────
async function createShop(req, res) {
  const {
    name, owner_name, email, phone, address,
    barcode_enabled = false,
    owner_username, owner_password,
    subscription_months = 1,
  } = req.body;

  if (!name || !owner_name || !email || !owner_username || !owner_password) {
    return res.status(400).json({
      error: 'name, owner_name, email, owner_username and owner_password are required',
    });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Calculate subscription end date
    const subEnd = new Date();
    subEnd.setMonth(subEnd.getMonth() + subscription_months);

    const { rows: shopRows } = await client.query(
      `INSERT INTO shops
         (name, owner_name, email, phone, address, subscription_status, subscription_end_date, barcode_enabled)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7)
       RETURNING *`,
      [name, owner_name, email, phone || null, address || null, subEnd, barcode_enabled]
    );
    const shop = shopRows[0];

    const hash = await bcrypt.hash(owner_password, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (shop_id, username, password_hash, role)
       VALUES ($1,$2,$3,'owner')
       RETURNING id, username, role`,
      [shop.id, owner_username, hash]
    );

    await client.query('COMMIT');
    res.status(201).json({ shop, owner: userRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A shop with this email already exists' });
    }
    console.error('createShop error:', err);
    res.status(500).json({ error: 'Server error creating shop' });
  } finally {
    client.release();
  }
}

// ── PUT /api/admin/shops/:id/subscription ────────────────────
async function updateSubscription(req, res) {
  const { subscription_status, extend_months } = req.body;

  try {
    const { rows: current } = await db.query(
      `SELECT * FROM shops WHERE id = $1`, [req.params.id]
    );
    if (current.length === 0) return res.status(404).json({ error: 'Shop not found' });

    let newEndDate = current[0].subscription_end_date
      ? new Date(current[0].subscription_end_date)
      : new Date();

    if (newEndDate < new Date()) newEndDate = new Date(); // start from today if already expired

    if (extend_months) {
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(extend_months, 10));
    }

    const newStatus = subscription_status || (extend_months ? 'active' : current[0].subscription_status);

    const { rows } = await db.query(
      `UPDATE shops
          SET subscription_status = $1,
              subscription_end_date = $2
        WHERE id = $3
        RETURNING *`,
      [newStatus, newEndDate, req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('updateSubscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops/:id ──────────────────────────────────
async function getShop(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM shops WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getShop error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops/:id/sales ───────────────────────────
async function getShopSales(req, res) {
  const { start_date, end_date, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const params = [req.params.id];
  const conditions = ['shop_id = $1'];

  if (start_date) { params.push(start_date); conditions.push(`transaction_date >= $${params.length}`); }
  if (end_date)   { params.push(end_date + ' 23:59:59'); conditions.push(`transaction_date <= $${params.length}`); }

  const where = conditions.join(' AND ');
  try {
    params.push(parseInt(limit, 10), offset);
    const { rows } = await db.query(
      `SELECT * FROM transactions WHERE ${where}
       ORDER BY transaction_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getShopSales error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/payments ───────────────────────────────────
async function listPayments(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT pay.*, s.name AS shop_name, s.owner_name
        FROM payments pay
        JOIN shops s ON s.id = pay.shop_id
       ORDER BY pay.payment_date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/payments/:id/verify ───────────────────────
async function verifyPayment(req, res) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM payments WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = rows[0];
    await client.query(
      `UPDATE payments SET status = 'verified' WHERE id = $1`, [payment.id]
    );

    // Extend subscription
    const { rows: shopRows } = await client.query(
      `SELECT * FROM shops WHERE id = $1`, [payment.shop_id]
    );
    const shop = shopRows[0];
    let newEnd = shop.subscription_end_date
      ? new Date(shop.subscription_end_date)
      : new Date();
    if (newEnd < new Date()) newEnd = new Date();
    newEnd.setMonth(newEnd.getMonth() + payment.subscription_months);

    await client.query(
      `UPDATE shops SET subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`,
      [newEnd, payment.shop_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payment verified and subscription extended', new_end_date: newEnd });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── PUT /api/admin/shops/:id ──────────────────────────────────
async function updateShop(req, res) {
  const { name, owner_name, email, phone, address, barcode_enabled } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE shops
          SET name            = COALESCE($1, name),
              owner_name      = COALESCE($2, owner_name),
              email           = COALESCE($3, email),
              phone           = COALESCE($4, phone),
              address         = COALESCE($5, address),
              barcode_enabled = COALESCE($6, barcode_enabled)
        WHERE id = $7
        RETURNING *`,
      [name, owner_name, email, phone, address, barcode_enabled, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateShop error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  adminLogin, getDashboard,
  listShops, createShop, getShop, updateShop,
  updateSubscription, getShopSales,
  listPayments, verifyPayment,
};
