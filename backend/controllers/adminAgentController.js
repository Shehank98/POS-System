const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db     = require('../config/database');
const { createAgentNotification, AGENT_TYPES } = require('./notificationController');
const { recalculateRiskScore } = require('../services/riskScoringService');

// ── GET /api/admin/agents ─────────────────────────────────────
async function listAgents(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT sa.id, sa.name, sa.email, sa.phone, sa.district, sa.monthly_target,
             sa.is_active, sa.created_at,
             sa.bank_name, sa.bank_account, sa.bank_branch, sa.account_holder,
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
             s.subscription_status, s.subscription_end_date,
             s.plan_id, s.subscription_months, s.expected_amount,
             sp.name AS plan_name,
             s.created_at
        FROM shops s
        LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
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
             s.name AS shop_name, s.owner_name, s.subscription_status
        FROM agent_payment_submissions aps
        JOIN sales_agents sa ON sa.id = aps.agent_id
        JOIN shops s ON s.id = aps.shop_id
       WHERE aps.status = 'pending_verification'
       ORDER BY aps.is_suspicious DESC, aps.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listPendingPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agent-payments/fraud-summary ──────────────
async function getFraudSummary(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM agent_payment_submissions WHERE is_suspicious = TRUE)                             AS total_suspicious,
        (SELECT COUNT(*) FROM agent_payment_submissions WHERE payment_detail_status = 'partial')                AS total_partial,
        (SELECT COUNT(*) FROM agent_payment_submissions WHERE payment_detail_status = 'mismatch')               AS total_mismatch,
        (SELECT COALESCE(SUM(shortage_amount),0) FROM agent_payment_submissions WHERE payment_detail_status = 'partial') AS total_shortage,
        (SELECT COUNT(DISTINCT agent_id) FROM agent_payment_submissions WHERE is_suspicious = TRUE)             AS flagged_agents,
        (SELECT COUNT(*) FROM agent_payment_flags WHERE created_at >= NOW() - INTERVAL '30 days')              AS flags_last_30d
    `);

    const { rows: byAgent } = await db.query(`
      SELECT sa.id, sa.name, sa.email,
             COUNT(*)                                                  AS total_submissions,
             SUM(CASE WHEN aps.is_suspicious THEN 1 ELSE 0 END)       AS suspicious_count,
             SUM(CASE WHEN aps.payment_detail_status = 'partial' THEN 1 ELSE 0 END) AS partial_count,
             COALESCE(SUM(aps.shortage_amount), 0)                    AS total_shortage
        FROM agent_payment_submissions aps
        JOIN sales_agents sa ON sa.id = aps.agent_id
       GROUP BY sa.id, sa.name, sa.email
      HAVING SUM(CASE WHEN aps.is_suspicious THEN 1 ELSE 0 END) > 0
       ORDER BY suspicious_count DESC
       LIMIT 20
    `);

    res.json({ summary: rows[0], risky_agents: byAgent });
  } catch (err) {
    console.error('getFraudSummary error:', err);
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
      SELECT aps.*, sa.name AS agent_name, s.name AS shop_name, s.subscription_status
        FROM agent_payment_submissions aps
        JOIN sales_agents sa ON sa.id = aps.agent_id
        JOIN shops s ON s.id = aps.shop_id
       ${where}
       ORDER BY aps.is_suspicious DESC NULLS LAST, aps.created_at DESC
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

    // Double-approval guard: check if this shop already has a verified payment
    // for the same billing month (same calendar month as payment_date)
    const billingMonth = sub.payment_date
      ? new Date(sub.payment_date).toISOString().slice(0, 7) + '-01'
      : new Date().toISOString().slice(0, 7) + '-01';

    const dupCheck = await client.query(
      `SELECT id FROM agent_payment_submissions
        WHERE shop_id = $1
          AND status  = 'verified'
          AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', $2::DATE)
          AND id != $3`,
      [sub.shop_id, billingMonth, submissionId]
    );
    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This shop already has a verified payment for that billing month. Double approval prevented.',
      });
    }

    await client.query(
      `UPDATE agent_payment_submissions SET status = 'verified', reviewed_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    // Extend subscription starting from the NEXT calendar month if the shop
    // was just signed up this month (prevents charging for signup month twice).
    // Rule: new end date = MAX(current end date, start of next month) + 1 month
    await client.query(
      `UPDATE shops
          SET subscription_status   = 'active',
              subscription_end_date = GREATEST(
                COALESCE(subscription_end_date, NOW()),
                DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
              ) + INTERVAL '1 month'
        WHERE id = $1`,
      [sub.shop_id]
    );

    // Unlock the onboarding commission if still pending
    await client.query(
      `UPDATE agent_commissions
          SET status = 'approved'
        WHERE agent_id = $1 AND shop_id = $2
          AND commission_type = 'onboarding'
          AND status IN ('pending', 'locked')`,
      [sub.agent_id, sub.shop_id]
    );

    // Create approved monthly commission for this payment
    await client.query(
      `INSERT INTO agent_commissions
         (agent_id, shop_id, commission_type, amount, month, status, earned_date, payment_submission_id)
       VALUES ($1, $2, 'monthly', 500, DATE_TRUNC('month', NOW()), 'approved', CURRENT_DATE, $3)
       ON CONFLICT (agent_id, shop_id, commission_type, month) WHERE month IS NOT NULL DO NOTHING`,
      [sub.agent_id, sub.shop_id, submissionId]
    );

    // Update agent wallet: increment total_verified
    await client.query(
      `INSERT INTO agent_wallet (agent_id, total_verified)
         VALUES ($1, $2)
         ON CONFLICT (agent_id) DO UPDATE
         SET total_verified = agent_wallet.total_verified + $2,
             updated_at     = NOW()`,
      [sub.agent_id, parseFloat(sub.amount)]
    );

    await client.query('COMMIT');

    // Notify agent (non-blocking)
    createAgentNotification(
      sub.agent_id,
      AGENT_TYPES.PAYMENT_VERIFIED,
      'Payment Verified',
      'Your payment submission has been verified and the shop subscription has been activated.',
      { submission_id: submissionId, shop_id: sub.shop_id }
    );

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
    const { rows, rowCount } = await db.query(
      `UPDATE agent_payment_submissions
          SET status = 'rejected', admin_note = $1, reviewed_at = NOW()
        WHERE id = $2 AND status = 'pending_verification'
        RETURNING agent_id`,
      [admin_note || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Submission not found or already processed' });

    const agentId = rows[0].agent_id;

    // Notify agent (non-blocking)
    createAgentNotification(
      agentId,
      AGENT_TYPES.PAYMENT_REJECTED,
      'Payment Rejected',
      admin_note
        ? `Your payment submission was rejected: ${admin_note}`
        : 'Your payment submission was rejected. Please contact admin for details.',
      { submission_id: parseInt(req.params.id, 10), admin_note }
    );

    // Recalculate risk score after rejection (non-blocking)
    recalculateRiskScore(agentId);

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
      SELECT ac.*,
             sa.name AS agent_name, sa.bank_name, sa.bank_account,
             sa.bank_branch, sa.account_holder,
             s.name AS shop_name
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

    // Notify agent (non-blocking)
    createAgentNotification(
      agent_id,
      AGENT_TYPES.PAYOUT_PROCESSED,
      'Commission Payout Processed',
      `A payout of LKR ${totalAmount.toLocaleString()} has been processed for ${updated.length} commission(s).`,
      { total_amount: totalAmount, paid_count: updated.length, commission_ids: updated.map((c) => c.id) }
    );

    res.json({ paid_count: updated.length, total_amount: totalAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('markPayout error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── GET /api/admin/agent-risk-scores ─────────────────────────
async function listRiskScores(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT ars.*, sa.name, sa.email, sa.phone, sa.is_active, sa.district
        FROM agent_risk_scores ars
        JOIN sales_agents sa ON sa.id = ars.agent_id
       ORDER BY ars.risk_score DESC, ars.updated_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listRiskScores error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agent-risk-scores/:agentId/recalculate ─────
async function recalculateAgentRisk(req, res) {
  const agentId = parseInt(req.params.agentId, 10);
  try {
    const result = await recalculateRiskScore(agentId);
    if (!result) return res.status(500).json({ error: 'Recalculation failed' });
    res.json(result);
  } catch (err) {
    console.error('recalculateAgentRisk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agent-risk-scores/:agentId/restrict ────────
async function setAgentRestriction(req, res) {
  const agentId   = parseInt(req.params.agentId, 10);
  const { restrict, reason } = req.body; // restrict: true = restrict, false = lift
  try {
    await db.query(
      `UPDATE agent_risk_scores
          SET is_restricted = $1,
              restriction_reason = $2,
              updated_at = NOW()
        WHERE agent_id = $3`,
      [Boolean(restrict), reason || null, agentId]
    );
    // Mirror is_active on the sales_agent row
    await db.query(
      `UPDATE sales_agents SET is_active = $1 WHERE id = $2`,
      [!restrict, agentId]
    );
    res.json({ ok: true, restricted: Boolean(restrict) });
  } catch (err) {
    console.error('setAgentRestriction error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/admin/generate-agent-invite ────────────────────
async function generateInviteToken(req, res) {
  const { note } = req.body;
  const token = crypto.randomBytes(32).toString('hex'); // 64-char hex, no pgcrypto needed
  try {
    const { rows } = await db.query(
      `INSERT INTO agent_registration_tokens (token, note)
       VALUES ($1, $2)
       RETURNING token, note, expires_at, created_at`,
      [token, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('generateInviteToken error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agent-registrations ───────────────────────
// Returns agents with approval_status = 'pending'
async function listPendingRegistrations(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT id, name, email, phone, district,
             nic_number, driving_license_number,
             nic_front_url, nic_back_url, agent_photo_url, bank_book_url,
             signed_agreement_url, bank_name, bank_account, bank_branch,
             account_holder, approval_status, rejection_reason, created_at
        FROM sales_agents
       WHERE approval_status = 'pending'
       ORDER BY created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('listPendingRegistrations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/agents/:id/documents ──────────────────────
async function getAgentDocuments(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, district,
              nic_number, driving_license_number,
              nic_front_url, nic_back_url, agent_photo_url, bank_book_url,
              signed_agreement_url, agreement_generated_at,
              bank_name, bank_account, bank_branch, account_holder,
              approval_status, rejection_reason, created_at
         FROM sales_agents WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getAgentDocuments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agents/:id/approve ────────────────────────
async function approveAgentRegistration(req, res) {
  const agentId = parseInt(req.params.id, 10);
  try {
    const { rows, rowCount } = await db.query(
      `UPDATE sales_agents
          SET approval_status = 'active', is_active = TRUE, rejection_reason = NULL
        WHERE id = $1
        RETURNING id, name, email, approval_status`,
      [agentId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Agent not found' });

    // Ensure wallet row exists
    await db.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT DO NOTHING`, [agentId]
    );

    res.json({ message: 'Agent approved and account activated', agent: rows[0] });
  } catch (err) {
    console.error('approveAgentRegistration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agents/:id/reject ─────────────────────────
async function rejectAgentRegistration(req, res) {
  const { reason } = req.body;
  const agentId = parseInt(req.params.id, 10);
  try {
    const { rows, rowCount } = await db.query(
      `UPDATE sales_agents
          SET approval_status = 'rejected', is_active = FALSE,
              rejection_reason = $1
        WHERE id = $2
        RETURNING id, name, email, approval_status`,
      [reason || null, agentId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ message: 'Agent registration rejected', agent: rows[0] });
  } catch (err) {
    console.error('rejectAgentRegistration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/invite-tokens ─────────────────────────────
async function listInviteTokens(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT t.id, t.token, t.note, t.expires_at, t.used_at, t.created_at,
             sa.name AS used_by_name, sa.email AS used_by_email
        FROM agent_registration_tokens t
        LEFT JOIN sales_agents sa ON sa.id = t.used_by
       ORDER BY t.created_at DESC
       LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('listInviteTokens error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agents/:id/signed-agreement ───────────────
// Admin manually saves the signed agreement URL (for agents registered before the fix)
async function saveSignedAgreementUrl(req, res) {
  const agentId = parseInt(req.params.id, 10);
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const { rowCount } = await db.query(
      `UPDATE sales_agents SET signed_agreement_url = $1 WHERE id = $2`,
      [url.trim(), agentId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ message: 'Signed agreement URL saved' });
  } catch (err) {
    console.error('saveSignedAgreementUrl error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops-by-agent ────────────────────────────
// Returns each agent with their shops + commission totals
async function getShopsByAgent(req, res) {
  try {
    // Agents with aggregated shop + commission data
    const { rows: agents } = await db.query(`
      SELECT
        sa.id, sa.name, sa.email, sa.phone, sa.district,
        sa.is_active, sa.approval_status, sa.created_at,
        COUNT(DISTINCT s.id)                                                           AS shop_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.activation_status = 'active')             AS active_shops,
        COUNT(DISTINCT s.id) FILTER (WHERE s.activation_status = 'inactive')           AS inactive_shops,
        COALESCE(SUM(ac.amount) FILTER (WHERE ac.status IN ('approved','paid')), 0)    AS earned_commission,
        COALESCE(SUM(ac.amount) FILTER (WHERE ac.status = 'approved'),           0)    AS pending_commission,
        COALESCE(SUM(ac.amount) FILTER (WHERE ac.status = 'paid'),               0)    AS paid_commission
      FROM sales_agents sa
      LEFT JOIN shops           s  ON s.onboarded_by_agent_id = sa.id
      LEFT JOIN agent_commissions ac ON ac.agent_id = sa.id
      GROUP BY sa.id
      ORDER BY COUNT(DISTINCT s.id) DESC, sa.name ASC
    `);

    // All shops with their agent id for the breakdown
    const { rows: shops } = await db.query(`
      SELECT
        s.id, s.name, s.owner_name, s.email, s.contact_number,
        s.shop_reference_id, s.shop_type,
        s.activation_status, s.subscription_status, s.subscription_end_date,
        s.location_map_url, s.district, s.created_at,
        s.onboarded_by_agent_id AS agent_id,
        COALESCE(SUM(ac.amount) FILTER (WHERE ac.status IN ('approved','paid')), 0) AS earned,
        COALESCE(SUM(ac.amount) FILTER (WHERE ac.status = 'approved'),           0) AS pending
      FROM shops s
      LEFT JOIN agent_commissions ac ON ac.shop_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    // Group shops under agents
    const shopsByAgent = {};
    shops.forEach((s) => {
      const aid = s.agent_id;
      if (!shopsByAgent[aid]) shopsByAgent[aid] = [];
      shopsByAgent[aid].push(s);
    });

    res.json(agents.map((a) => ({ ...a, shops: shopsByAgent[a.id] || [] })));
  } catch (err) {
    console.error('getShopsByAgent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shops/map-data ────────────────────────────
// Returns all shops with location + agent info for the map view
async function getShopsMapData(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.name, s.owner_name, s.shop_type,
             s.location_lat, s.location_lng, s.location_map_url,
             s.shop_reference_id, s.activation_status, s.subscription_status,
             s.district,
             sa.id AS agent_id, sa.name AS agent_name, sa.district AS agent_district
        FROM shops s
        LEFT JOIN sales_agents sa ON sa.id = s.onboarded_by_agent_id
       ORDER BY s.name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('getShopsMapData error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/agents/:id/bank-details ────────────────────
async function updateAgentBankDetails(req, res) {
  const agentId = parseInt(req.params.id, 10);
  const { bank_name, bank_account, bank_branch, account_holder } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE sales_agents
          SET bank_name      = COALESCE($1, bank_name),
              bank_account   = COALESCE($2, bank_account),
              bank_branch    = COALESCE($3, bank_branch),
              account_holder = COALESCE($4, account_holder)
        WHERE id = $5
        RETURNING id, bank_name, bank_account, bank_branch, account_holder`,
      [bank_name || null, bank_account || null, bank_branch || null, account_holder || null, agentId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Agent not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateAgentBankDetails error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listAgents, createAgent, updateAgent, getAgentCustomers,
  listPendingPayments, listAllPayments, getFraudSummary,
  verifyPayment, rejectPayment,
  listCommissions, markPayout,
  listRiskScores, recalculateAgentRisk, setAgentRestriction,
  generateInviteToken, listPendingRegistrations, getAgentDocuments,
  approveAgentRegistration, rejectAgentRegistration, listInviteTokens,
  saveSignedAgreementUrl, getShopsByAgent, getShopsMapData,
  updateAgentBankDetails,
};
