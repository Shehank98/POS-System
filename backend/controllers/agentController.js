const bcrypt = require('bcryptjs');
const db     = require('../config/database');

// ── GET /api/agents/me/dashboard ──────────────────────────────
async function getDashboard(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1)                              AS total_customers,
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1 AND subscription_status = 'active')  AS active_customers,
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1 AND subscription_status != 'active') AS inactive_customers,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status = 'approved')                    AS approved_earnings,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status = 'locked')                     AS pending_earnings,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status = 'paid')                       AS total_paid,
        (SELECT COUNT(*)                FROM agent_payment_submissions WHERE agent_id = $1 AND status = 'pending_verification') AS pending_submissions,
        (SELECT monthly_target          FROM sales_agents      WHERE id = $1)                                                  AS monthly_target
    `, [agentId]);

    const { rows: expiring } = await db.query(`
      SELECT id, name, subscription_end_date
        FROM shops
       WHERE onboarded_by_agent_id = $1
         AND subscription_status = 'active'
         AND subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       ORDER BY subscription_end_date
    `, [agentId]);

    res.json({ ...rows[0], expiring_soon: expiring });
  } catch (err) {
    console.error('agent getDashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/customers ──────────────────────────────
async function listCustomers(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT id, name, owner_name, email, phone, address,
             subscription_status, subscription_end_date, created_at
        FROM shops
       WHERE onboarded_by_agent_id = $1
       ORDER BY created_at DESC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent listCustomers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/agents/me/customers ─────────────────────────────
async function onboardCustomer(req, res) {
  const agentId = req.agent.id;
  const { name, owner_name, email, phone, address, username, password } = req.body;
  if (!name || !owner_name || !email) {
    return res.status(400).json({ error: 'name, owner_name and email are required' });
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required for the shop login account' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: shopRows } = await client.query(
      `INSERT INTO shops (name, owner_name, email, phone, address, subscription_status, onboarded_by_agent_id)
       VALUES ($1, $2, $3, $4, $5, 'trial', $6)
       RETURNING id, name, owner_name, email, subscription_status, created_at`,
      [name, owner_name, email.toLowerCase().trim(), phone || null, address || null, agentId]
    );
    const shop = shopRows[0];

    // Create the owner login account for this shop
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (shop_id, username, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [shop.id, username.trim(), passwordHash]
    );

    // Signup commission is locked until admin verifies first payment
    await client.query(
      `INSERT INTO agent_commissions (agent_id, shop_id, commission_type, amount, status)
       VALUES ($1, $2, 'signup', 500, 'locked')`,
      [agentId, shop.id]
    );

    await client.query('COMMIT');
    res.status(201).json(shop);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('username')) return res.status(409).json({ error: 'That username is already taken' });
      return res.status(409).json({ error: 'A shop with this email already exists' });
    }
    console.error('agent onboardCustomer error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── PUT /api/agents/me/customers/:shopId ──────────────────────
async function editCustomer(req, res) {
  const agentId = req.agent.id;
  const shopId  = parseInt(req.params.shopId, 10);
  const { name, owner_name, phone, address } = req.body;
  try {
    const check = await db.query(
      `SELECT id FROM shops WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shopId, agentId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const { rows } = await db.query(
      `UPDATE shops SET
         name       = COALESCE($1, name),
         owner_name = COALESCE($2, owner_name),
         phone      = COALESCE($3, phone),
         address    = COALESCE($4, address)
       WHERE id = $5
       RETURNING id, name, owner_name, email, phone, address, subscription_status`,
      [name || null, owner_name || null, phone || null, address || null, shopId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('agent editCustomer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/agents/me/payments ──────────────────────────────
async function submitPayment(req, res) {
  const agentId = req.agent.id;
  const { shop_id, amount, payment_method = 'cash', payment_date, notes } = req.body;
  if (!shop_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'shop_id, amount and payment_date are required' });
  }
  if (Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  try {
    const check = await db.query(
      `SELECT id FROM shops WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shop_id, agentId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const { rows } = await db.query(
      `INSERT INTO agent_payment_submissions
         (agent_id, shop_id, amount, payment_method, payment_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_verification')
       RETURNING *`,
      [agentId, shop_id, Number(amount), payment_method, payment_date, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('agent submitPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/payments ───────────────────────────────
async function listPayments(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT aps.*, s.name AS shop_name
        FROM agent_payment_submissions aps
        JOIN shops s ON s.id = aps.shop_id
       WHERE aps.agent_id = $1
       ORDER BY aps.created_at DESC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent listPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/commissions ────────────────────────────
async function listCommissions(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT ac.*, s.name AS shop_name
        FROM agent_commissions ac
        JOIN shops s ON s.id = ac.shop_id
       WHERE ac.agent_id = $1
       ORDER BY ac.created_at DESC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent listCommissions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/agents/me/bank-details ───────────────────────────
async function updateBankDetails(req, res) {
  const agentId = req.agent.id;
  const { bank_name, bank_account, bank_branch, account_holder } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE sales_agents
          SET bank_name = $1, bank_account = $2, bank_branch = $3, account_holder = $4
        WHERE id = $5
        RETURNING id, bank_name, bank_account, bank_branch, account_holder`,
      [bank_name || null, bank_account || null, bank_branch || null, account_holder || null, agentId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('agent updateBankDetails error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/renewals ───────────────────────────────
async function getRenewals(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT id, name, owner_name, phone, subscription_status, subscription_end_date
        FROM shops
       WHERE onboarded_by_agent_id = $1
         AND (
           subscription_status = 'expired'
           OR (subscription_status = 'active' AND subscription_end_date <= NOW() + INTERVAL '7 days')
         )
       ORDER BY subscription_end_date ASC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent getRenewals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getDashboard, listCustomers, onboardCustomer, editCustomer,
  submitPayment, listPayments, listCommissions, updateBankDetails, getRenewals,
};
