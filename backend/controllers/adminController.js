const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');
const { createNotification, TYPES } = require('./notificationController');

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
    // Use correlated subqueries to avoid Cartesian-product count inflation
    // that occurs when LEFT JOINing multiple one-to-many tables simultaneously.
    const { rows } = await db.query(`
      SELECT s.*,
             (SELECT COUNT(*) FROM users       u WHERE u.shop_id = s.id) AS user_count,
             (SELECT COUNT(*) FROM products    p WHERE p.shop_id = s.id) AS product_count,
             (SELECT COUNT(*) FROM transactions t WHERE t.shop_id = s.id) AS transaction_count
        FROM shops s
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
    logo_url, contact_email,
    barcode_enabled = false,
    shop_type = 'retail',
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
         (name, owner_name, email, phone, address,
          subscription_status, subscription_end_date, barcode_enabled, shop_type)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8)
       RETURNING *`,
      [name, owner_name, email, phone || null, address || null, subEnd, barcode_enabled, shop_type || 'retail']
    );
    const shop = shopRows[0];

    // Set optional columns added by migrations (logo_url, contact_email).
    // Use a SAVEPOINT so the whole transaction doesn't abort if the columns
    // don't exist yet on this database instance.
    if (logo_url || contact_email) {
      await client.query('SAVEPOINT before_optional_cols');
      try {
        await client.query(
          'UPDATE shops SET logo_url = $1, contact_email = $2 WHERE id = $3',
          [logo_url || null, contact_email || null, shop.id]
        );
        await client.query('RELEASE SAVEPOINT before_optional_cols');
      } catch (optErr) {
        await client.query('ROLLBACK TO SAVEPOINT before_optional_cols');
        if (optErr.code !== '42703') throw optErr; // re-throw unexpected errors
        // Column doesn't exist yet (run migration 005) — silently skip
      }
    }

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

    // extend_months > 0: add months from today (not from existing expiry)
    // extend_months = 0 or absent: keep existing end date, just change status
    let newEndDate = current[0].subscription_end_date
      ? new Date(current[0].subscription_end_date)
      : new Date();

    const months = parseInt(extend_months, 10) || 0;
    if (months > 0) {
      newEndDate = new Date(); // always count from today
      newEndDate.setMonth(newEndDate.getMonth() + months);
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

    // Notify the shop
    await createNotification(
      payment.shop_id,
      TYPES.PAYMENT_APPROVED,
      'Payment Approved',
      `Your payment has been approved. Subscription extended to ${newEnd.toLocaleDateString()}.`,
      { new_end_date: newEnd, payment_id: payment.id }
    );

    res.json({ message: 'Payment verified and subscription extended', new_end_date: newEnd });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── PUT /api/admin/payments/:id/reject ───────────────────────
async function rejectPayment(req, res) {
  const { notes } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT * FROM payments WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const payment = rows[0];
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payments can be rejected' });
    }

    await db.query(
      `UPDATE payments SET status = 'rejected', notes = $1 WHERE id = $2`,
      [notes || null, payment.id]
    );

    await createNotification(
      payment.shop_id,
      TYPES.PAYMENT_REJECTED,
      'Payment Rejected',
      notes
        ? `Your payment was rejected: ${notes}`
        : 'Your payment was rejected. Please contact support or resubmit with correct details.',
      { payment_id: payment.id, notes }
    );

    res.json({ message: 'Payment rejected' });
  } catch (err) {
    console.error('rejectPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops/:id/users ───────────────────────────
async function getShopUsers(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, username, role, created_at FROM users WHERE shop_id = $1 ORDER BY role, username`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getShopUsers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/shops/:shopId/users/:userId/password ───────
async function changeUserPassword(req, res) {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  try {
    const hash = await bcrypt.hash(new_password, 10);
    const { rowCount } = await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND shop_id = $3`,
      [hash, req.params.userId, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'User not found in this shop' });
    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('changeUserPassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/shops/:id ──────────────────────────────────
async function updateShop(req, res) {
  const {
    name, owner_name, email, phone, address,
    logo_url, contact_email, barcode_enabled,
    extra_staff_slots, shop_type, default_tax_rate, grace_period_days,
    // Feature flags
    pre_orders_enabled, customers_enabled, reports_enabled, analytics_enabled,
    loyalty_enabled, refunds_enabled, void_enabled, offline_enabled,
    exchanges_enabled, branches_enabled,
  } = req.body;

  const emailVal        = email         && email.trim()        ? email.trim()        : null;
  const logoUrlVal      = logo_url      !== undefined          ? (logo_url      || null) : undefined;
  const contactEmailVal = contact_email !== undefined          ? (contact_email  || null) : undefined;
  const taxRateVal      = default_tax_rate !== undefined       ? parseFloat(default_tax_rate) : null;
  const graceVal        = grace_period_days !== undefined      ? parseInt(grace_period_days, 10) : null;

  const boolOrNull = (v) => v !== undefined ? Boolean(v) : null;

  try {
    const { rows } = await db.query(
      `UPDATE shops
          SET name                = COALESCE($1,  name),
              owner_name          = COALESCE($2,  owner_name),
              email               = COALESCE($3,  email),
              phone               = COALESCE($4,  phone),
              address             = COALESCE($5,  address),
              logo_url            = COALESCE($6,  logo_url),
              contact_email       = COALESCE($7,  contact_email),
              barcode_enabled     = COALESCE($8,  barcode_enabled),
              extra_staff_slots   = COALESCE($9,  extra_staff_slots),
              shop_type           = COALESCE($10, shop_type),
              default_tax_rate    = COALESCE($11, default_tax_rate),
              grace_period_days   = COALESCE($12, grace_period_days),
              pre_orders_enabled  = COALESCE($13, pre_orders_enabled),
              customers_enabled   = COALESCE($14, customers_enabled),
              reports_enabled     = COALESCE($15, reports_enabled),
              analytics_enabled   = COALESCE($16, analytics_enabled),
              loyalty_enabled     = COALESCE($17, loyalty_enabled),
              refunds_enabled     = COALESCE($18, refunds_enabled),
              void_enabled        = COALESCE($19, void_enabled),
              offline_enabled     = COALESCE($20, offline_enabled),
              exchanges_enabled   = COALESCE($21, exchanges_enabled),
              branches_enabled    = COALESCE($22, branches_enabled)
        WHERE id = $23
        RETURNING *`,
      [
        name, owner_name, emailVal, phone, address,
        logoUrlVal, contactEmailVal,
        barcode_enabled !== undefined ? Boolean(barcode_enabled) : null,
        extra_staff_slots !== undefined ? parseInt(extra_staff_slots, 10) : null,
        shop_type || null,
        taxRateVal, graceVal,
        boolOrNull(pre_orders_enabled), boolOrNull(customers_enabled),
        boolOrNull(reports_enabled),    boolOrNull(analytics_enabled),
        boolOrNull(loyalty_enabled),    boolOrNull(refunds_enabled),
        boolOrNull(void_enabled),       boolOrNull(offline_enabled),
        boolOrNull(exchanges_enabled),  boolOrNull(branches_enabled),
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A shop with this email already exists' });
    }
    console.error('updateShop error:', err.code, err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/admin/shops/:id ───────────────────────────────
async function deleteShop(req, res) {
  const { confirm } = req.body;
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Send { confirm: "DELETE" } to confirm shop deletion' });
  }

  try {
    const { rowCount } = await db.query(
      `DELETE FROM shops WHERE id = $1`, [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Shop not found' });
    res.status(204).end();
  } catch (err) {
    console.error('deleteShop error:', err);
    res.status(500).json({ error: 'Server error deleting shop' });
  }
}

// ── POST /api/admin/shops/:id/users ───────────────────────────
async function addShopUser(req, res) {
  const { username, password, role = 'cashier' } = req.body;
  const shopId = parseInt(req.params.id, 10);

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const allowedRoles = ['owner', 'manager', 'cashier'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'role must be owner, manager, or cashier' });
  }

  try {
    const shopCheck = await db.query(`SELECT id FROM shops WHERE id = $1`, [shopId]);
    if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (shop_id, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, created_at`,
      [shopId, username, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists in this shop' });
    }
    console.error('addShopUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/admin/shops/:id/users/:userId ─────────────────
async function deleteShopUser(req, res) {
  const shopId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);

  try {
    // Prevent deleting the last owner
    const ownerCheck = await db.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE shop_id = $1 AND role = 'owner'`,
      [shopId]
    );
    const targetRole = await db.query(
      `SELECT role FROM users WHERE id = $1 AND shop_id = $2`,
      [userId, shopId]
    );
    if (targetRole.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in this shop' });
    }
    if (targetRole.rows[0].role === 'owner' && parseInt(ownerCheck.rows[0].cnt, 10) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last owner of a shop' });
    }

    await db.query(`DELETE FROM users WHERE id = $1 AND shop_id = $2`, [userId, shopId]);
    res.status(204).end();
  } catch (err) {
    console.error('deleteShopUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/analysis ───────────────────────────────────
async function getAnalysis(req, res) {
  const { start_date, end_date, shop_id } = req.query;

  // Build parameterised WHERE conditions for completed transactions
  const params = [];
  const txnConds = ["t.status = 'completed'"];

  if (start_date) {
    params.push(start_date);
    txnConds.push(`t.transaction_date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date + ' 23:59:59');
    txnConds.push(`t.transaction_date <= $${params.length}`);
  }
  if (shop_id) {
    params.push(parseInt(shop_id, 10));
    txnConds.push(`t.shop_id = $${params.length}`);
  }

  const where = `WHERE ${txnConds.join(' AND ')}`;

  try {
    // ── Overview totals ────────────────────────────────────────
    const { rows: ov } = await db.query(
      `SELECT
         COALESCE(SUM(t.total_amount), 0)                              AS total_revenue,
         COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0)    AS total_cost,
         COUNT(DISTINCT t.id)                                           AS transaction_count
       FROM transactions t
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       LEFT JOIN products           p  ON p.id = ti.product_id
       ${where}`,
      params
    );

    // ── Top 20 products ────────────────────────────────────────
    const { rows: topProducts } = await db.query(
      `SELECT
         COALESCE(p.name, '[Deleted Product]')                         AS name,
         SUM(ti.quantity)::numeric                                      AS qty_sold,
         COALESCE(SUM(ti.subtotal), 0)                                 AS revenue,
         COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0)    AS cost,
         COALESCE(SUM(ti.subtotal), 0)
           - COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) AS profit
       FROM transaction_items ti
       JOIN  transactions t ON t.id = ti.transaction_id
       LEFT JOIN products   p ON p.id = ti.product_id
       ${where}
       GROUP BY p.id, p.name
       ORDER BY revenue DESC
       LIMIT 20`,
      params
    );

    // ── Per-shop breakdown (only when not filtering by a single shop) ──
    let shopBreakdown = [];
    if (!shop_id) {
      const bkParams = [];
      const bkJoinConds = ["t.shop_id = s.id", "t.status = 'completed'"];
      if (start_date) {
        bkParams.push(start_date);
        bkJoinConds.push(`t.transaction_date >= $${bkParams.length}`);
      }
      if (end_date) {
        bkParams.push(end_date + ' 23:59:59');
        bkJoinConds.push(`t.transaction_date <= $${bkParams.length}`);
      }
      const joinOn = bkJoinConds.join(' AND ');

      const { rows } = await db.query(
        `SELECT
           s.id                                                          AS shop_id,
           s.name                                                        AS shop_name,
           COALESCE(SUM(t.total_amount), 0)                             AS revenue,
           COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0)   AS cost,
           COALESCE(SUM(t.total_amount), 0)
             - COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) AS profit,
           COUNT(DISTINCT t.id)                                          AS transaction_count
         FROM shops s
         LEFT JOIN transactions      t  ON ${joinOn}
         LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
         LEFT JOIN products           p  ON p.id = ti.product_id
         GROUP BY s.id, s.name
         ORDER BY revenue DESC`,
        bkParams
      );
      shopBreakdown = rows;
    }

    res.json({
      total_revenue:     Number(ov[0].total_revenue),
      total_cost:        Number(ov[0].total_cost),
      total_profit:      Number(ov[0].total_revenue) - Number(ov[0].total_cost),
      transaction_count: Number(ov[0].transaction_count),
      top_products:      topProducts,
      shop_breakdown:    shopBreakdown,
    });
  } catch (err) {
    console.error('getAnalysis error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/payments/:id/proof ────────────────────────
async function getPaymentProof(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT payment_proof FROM payments WHERE id = $1`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment_proof: rows[0].payment_proof });
  } catch (err) {
    console.error('getPaymentProof error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  adminLogin, getDashboard,
  listShops, createShop, getShop, updateShop, deleteShop,
  getShopUsers, changeUserPassword, addShopUser, deleteShopUser,
  updateSubscription, getShopSales,
  listPayments, verifyPayment, rejectPayment, getPaymentProof,
  getAnalysis,
};
