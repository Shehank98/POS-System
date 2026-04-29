const bcrypt = require('bcryptjs');
const db     = require('../config/database');

// ── GET /api/admin/agents ─────────────────────────────────────
async function listAgents(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT sa.id, sa.name, sa.email, sa.phone, sa.district, sa.monthly_target,
             sa.is_active, sa.created_at,
             (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = sa.id)                              AS total_customers,
             (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = sa.id AND subscription_status = 'active') AS active_customers,
             (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = sa.id AND status = 'approved')                    AS approved_commissions
        FROM sales_agents sa
       ORDER BY sa.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listAgents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/admin/agents ────────────────────────────────────
async function createAgent(req, res) {
  const { name, email, phone, password, district, monthly_target = 0 } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO sales_agents (name, email, phone, password_hash, district, monthly_target)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, district, monthly_target, is_active, created_at`,
      [name, email.toLowerCase().trim(), phone || null, hash, district || null, monthly_target]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('createAgent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agents/:id ─────────────────────────────────
async function updateAgent(req, res) {
  const { name, phone, district, monthly_target, is_active, password } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(`UPDATE sales_agents SET password_hash = $1 WHERE id = $2`, [hash, req.params.id]);
    }
    const { rows } = await db.query(
      `UPDATE sales_agents SET
         name           = COALESCE($1, name),
         phone          = COALESCE($2, phone),
         district       = COALESCE($3, district),
         monthly_target = COALESCE($4, monthly_target),
         is_active      = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING id, name, email, phone, district, monthly_target, is_active`,
      [name || null, phone || null, district || null,
       monthly_target != null ? monthly_target : null,
       is_active != null ? is_active : null,
       req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateAgent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agents/:id/customers ───────────────────────
async function getAgentCustomers(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.name, s.owner_name, s.email, s.phone,
             s.subscription_status, s.subscription_end_date, s.created_at
        FROM shops s
       WHERE s.onboarded_by_agent_id = $1
       ORDER BY s.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('getAgentCustomers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agent-payments/pending ─────────────────────
async function listPendingPayments(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT aps.*, sa.name AS agent_name, sa.phone AS agent_phone,
             s.name AS shop_name, s.owner_name
        FROM agent_payment_submissions aps
        JOIN sales_agents sa ON sa.id = aps.agent_id
        JOIN shops s ON s.id = aps.shop_id
       WHERE aps.status = 'pending_verification'
       ORDER BY aps.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listPendingPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agent-payments ────────────────────────────
async function listAllPayments(req, res) {
  const { status } = req.query;
  try {
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE aps.status = $1`; }

    const { rows } = await db.query(`
      SELECT aps.*, sa.name AS agent_name, s.name AS shop_name
        FROM agent_payment_submissions aps
        JOIN sales_agents sa ON sa.id = aps.agent_id
        JOIN shops s ON s.id = aps.shop_id
       ${where}
       ORDER BY aps.created_at DESC
       LIMIT 500
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('listAllPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agent-payments/:id/verify ─────────────────
// Atomic: verify submission → activate shop → unlock commissions
async function verifyPayment(req, res) {
  const submissionId = parseInt(req.params.id, 10);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: subRows } = await client.query(
      `SELECT * FROM agent_payment_submissions WHERE id = $1 AND status = 'pending_verification'`,
      [submissionId]
    );
    if (subRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found or already processed' });
    }
    const sub = subRows[0];

    await client.query(
      `UPDATE agent_payment_submissions SET status = 'verified', reviewed_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    // Extend subscription by 1 month (never shrink existing end date)
    await client.query(
      `UPDATE shops
          SET subscription_status    = 'active',
              subscription_end_date  = GREATEST(COALESCE(subscription_end_date, NOW()), NOW()) + INTERVAL '1 month'
        WHERE id = $1`,
      [sub.shop_id]
    );

    // Unlock the signup commission if still locked
    await client.query(
      `UPDATE agent_commissions
          SET status = 'approved'
        WHERE agent_id = $1 AND shop_id = $2 AND commission_type = 'signup' AND status = 'locked'`,
      [sub.agent_id, sub.shop_id]
    );

    // Create approved recurring commission for this payment
    await client.query(
      `INSERT INTO agent_commissions
         (agent_id, shop_id, commission_type, amount, month, status, payment_submission_id)
       VALUES ($1, $2, 'recurring', 500, DATE_TRUNC('month', NOW()), 'approved', $3)`,
      [sub.agent_id, sub.shop_id, submissionId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payment verified, shop activated, commissions unlocked' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── PUT /api/admin/agent-payments/:id/reject ─────────────────
async function rejectPayment(req, res) {
  const { admin_note } = req.body;
  try {
    const { rowCount } = await db.query(
      `UPDATE agent_payment_submissions
          SET status = 'rejected', admin_note = $1, reviewed_at = NOW()
        WHERE id = $2 AND status = 'pending_verification'`,
      [admin_note || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Submission not found or already processed' });
    res.json({ message: 'Payment rejected' });
  } catch (err) {
    console.error('rejectPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agent-commissions ─────────────────────────
async function listCommissions(req, res) {
  const { agent_id, status } = req.query;
  try {
    const params = [];
    const conditions = [];
    if (agent_id) { params.push(agent_id); conditions.push(`ac.agent_id = $${params.length}`); }
    if (status)   { params.push(status);   conditions.push(`ac.status   = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT ac.*, sa.name AS agent_name, s.name AS shop_name
        FROM agent_commissions ac
        JOIN sales_agents sa ON sa.id = ac.agent_id
        JOIN shops s ON s.id = ac.shop_id
       ${where}
       ORDER BY ac.created_at DESC
       LIMIT 500
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('listCommissions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agent-commissions/payout ──────────────────
async function markPayout(req, res) {
  const { commission_ids, agent_id, notes } = req.body;
  if (!commission_ids?.length || !agent_id) {
    return res.status(400).json({ error: 'commission_ids and agent_id are required' });
  }
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: updated } = await client.query(
      `UPDATE agent_commissions SET status = 'paid', paid_at = NOW()
        WHERE id = ANY($1) AND agent_id = $2 AND status = 'approved'
        RETURNING id, amount`,
      [commission_ids, agent_id]
    );
    if (updated.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No eligible commissions to mark as paid' });
    }

    const totalAmount = updated.reduce((s, c) => s + parseFloat(c.amount), 0);
    await client.query(
      `INSERT INTO agent_payout_logs (agent_id, amount, commission_ids, notes)
       VALUES ($1, $2, $3, $4)`,
      [agent_id, totalAmount, updated.map((c) => c.id), notes || null]
    );

    await client.query('COMMIT');
    res.json({ paid_count: updated.length, total_amount: totalAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('markPayout error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  listAgents, createAgent, updateAgent, getAgentCustomers,
  listPendingPayments, listAllPayments, verifyPayment, rejectPayment,
  listCommissions, markPayout,
};
