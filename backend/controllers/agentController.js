const bcrypt = require('bcryptjs');
const db     = require('../config/database');
const { createAdminNotification, ADMIN_TYPES } = require('./notificationController');
const { recalculateRiskScore } = require('../services/riskScoringService');
const { uploadFile } = require('../utils/storageService');

// ── POST /api/agents/shops/upload-selfie (public) ─────────────
async function uploadShopSelfie(req, res) {
  const { fileData, ref } = req.body;
  if (!fileData) return res.status(400).json({ error: 'fileData is required' });

  const mime = fileData.match(/^data:(image\/[a-zA-Z]+);base64,/)?.[1] || '';
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(mime)) {
    return res.status(400).json({ error: 'Only JPG and PNG images are accepted' });
  }
  const base64 = fileData.replace(/^data:[^;]+;base64,/, '');
  const sizeBytes = Math.ceil(base64.length * 0.75);
  if (sizeBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File must be under 5MB' });
  }

  try {
    const ext  = mime.includes('png') ? 'png' : 'jpg';
    const dest = `shops/selfies/${ref || 'tmp'}_${Date.now()}.${ext}`;
    const url  = await uploadFile(fileData, dest, mime);
    res.json({ url });
  } catch (err) {
    console.error('uploadShopSelfie error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// ── GET /api/agents/me/dashboard ──────────────────────────────
async function getDashboard(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1)                              AS total_customers,
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1 AND subscription_status = 'active')  AS active_customers,
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1 AND subscription_status != 'active') AS inactive_customers,
        (SELECT COUNT(*)                FROM shops             WHERE onboarded_by_agent_id = $1 AND subscription_status = 'pending_payment') AS pending_payment_shops,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status = 'approved')                           AS approved_earnings,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status IN ('pending','locked'))               AS pending_earnings,
        (SELECT COALESCE(SUM(amount),0) FROM agent_commissions WHERE agent_id = $1 AND status = 'paid')                              AS total_paid,
        (SELECT COUNT(*)                FROM agent_payment_submissions WHERE agent_id = $1 AND status = 'pending_verification') AS pending_submissions,
        (SELECT monthly_target          FROM sales_agents      WHERE id = $1)                                                  AS monthly_target,
        (SELECT total_collected         FROM agent_wallet      WHERE agent_id = $1)                                            AS wallet_collected,
        (SELECT total_verified          FROM agent_wallet      WHERE agent_id = $1)                                            AS wallet_verified,
        (SELECT COALESCE(balance,0)     FROM agent_wallet      WHERE agent_id = $1)                                            AS account_balance
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
      SELECT s.id, s.name, s.owner_name, s.email, s.phone, s.address,
             s.subscription_status, s.subscription_end_date,
             s.plan_id, s.subscription_months, s.expected_amount,
             sp.name AS plan_name,
             s.created_at
        FROM shops s
        LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.onboarded_by_agent_id = $1
       ORDER BY s.created_at DESC
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
  const {
    name, owner_name, email, phone, address,
    username, password,
    plan_id, subscription_months = 1,
    barcode_enabled = false, shop_type = 'retail',
  } = req.body;

  if (!name || !owner_name || !email) {
    return res.status(400).json({ error: 'name, owner_name and email are required' });
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required for the shop login account' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const months = Math.max(1, parseInt(subscription_months, 10) || 1);

  // Calculate expected amount from plan
  let expectedAmount = null;
  if (plan_id) {
    try {
      const { rows: planRows } = await db.query(
        `SELECT base_monthly_price, discount_3m, discount_6m, discount_12m
           FROM subscription_plans WHERE id = $1 AND is_active = TRUE`,
        [plan_id]
      );
      if (planRows.length > 0) {
        const p = planRows[0];
        let discount = 0;
        if (months >= 12) discount = parseFloat(p.discount_12m);
        else if (months >= 6) discount = parseFloat(p.discount_6m);
        else if (months >= 3) discount = parseFloat(p.discount_3m);
        expectedAmount = parseFloat(p.base_monthly_price) * months * (1 - discount);
      }
    } catch (_) { /* non-fatal */ }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: shopRows } = await client.query(
      `INSERT INTO shops
         (name, owner_name, email, phone, address,
          subscription_status, onboarded_by_agent_id,
          plan_id, subscription_months, expected_amount,
          barcode_enabled, shop_type)
       VALUES ($1, $2, $3, $4, $5, 'pending_payment', $6, $7, $8, $9, $10, $11)
       RETURNING id, name, owner_name, email, subscription_status, created_at,
                 plan_id, subscription_months, expected_amount`,
      [
        name, owner_name, email.toLowerCase().trim(),
        phone || null, address || null, agentId,
        plan_id || null, months, expectedAmount,
        Boolean(barcode_enabled), shop_type,
      ]
    );
    const shop = shopRows[0];

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (shop_id, username, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [shop.id, username.trim(), passwordHash]
    );

    // Onboarding commission (pending until first payment verified)
    await client.query(
      `INSERT INTO agent_commissions (agent_id, shop_id, commission_type, amount, status, earned_date)
       VALUES ($1, $2, 'onboarding', 500, 'pending', CURRENT_DATE)`,
      [agentId, shop.id]
    );

    // Ensure wallet row exists for this agent
    await client.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING`,
      [agentId]
    );

    await client.query('COMMIT');

    // Fetch agent name for notification (non-blocking)
    db.query(`SELECT name FROM sales_agents WHERE id = $1`, [agentId])
      .then(({ rows: agRows }) => {
        const agentName = agRows[0]?.name || `Agent #${agentId}`;
        createAdminNotification(
          ADMIN_TYPES.SHOP_ONBOARDED,
          'New Shop Onboarded',
          `${agentName} onboarded shop "${name}" (${(shop_type || 'retail').replace('_', ' ')})`,
          'high',
          { agent_id: agentId, shop_id: shop.id, shop_name: name }
        );
      })
      .catch(() => {});

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

// ── Payment fraud classification helper ───────────────────────
function classifyPayment(submittedAmt, expectedAmt) {
  if (expectedAmt === null || expectedAmt === 0) {
    return { detailStatus: 'full', isSuspicious: false, flagReason: null };
  }
  const diff = submittedAmt - expectedAmt;
  const pct  = diff / expectedAmt;

  if (submittedAmt >= expectedAmt) {
    return {
      detailStatus: submittedAmt > expectedAmt ? 'overpayment' : 'full',
      isSuspicious: false,
      flagReason:   submittedAmt > expectedAmt
        ? `Overpayment: LKR ${(submittedAmt - expectedAmt).toFixed(2)} excess`
        : null,
    };
  }
  // partial (below expected)
  const shortage = expectedAmt - submittedAmt;
  const isMismatch = pct < -0.05; // >5% shortage triggers mismatch/suspicious flag
  return {
    detailStatus: 'partial',
    isSuspicious: isMismatch,
    flagReason:   `Partial payment: short by LKR ${shortage.toFixed(2)} (${Math.abs(pct * 100).toFixed(1)}% below expected)`,
  };
}

// ── POST /api/agents/me/payments ──────────────────────────────
async function submitPayment(req, res) {
  const agentId = req.agent.id;
  const { shop_id, amount, payment_method = 'cash', payment_date, notes } = req.body;
  if (!shop_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'shop_id, amount and payment_date are required' });
  }
  if (Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const submittedAmt = Number(amount);

  try {
    // Fetch shop to get expected_amount
    const check = await db.query(
      `SELECT id, expected_amount FROM shops WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shop_id, agentId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const shopExpected = check.rows[0].expected_amount ? parseFloat(check.rows[0].expected_amount) : null;

    const { detailStatus, isSuspicious, flagReason } = classifyPayment(submittedAmt, shopExpected);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO agent_payment_submissions
           (agent_id, shop_id, amount, submitted_amount, expected_amount,
            payment_method, payment_date, notes, status, is_suspicious,
            payment_detail_status, flag_reason)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'pending_verification', $8, $9, $10)
         RETURNING *`,
        [agentId, shop_id, submittedAmt, shopExpected, payment_method, payment_date, notes || null,
         isSuspicious, detailStatus || null, flagReason || null]
      );

      // Insert fraud flag record for audit trail
      if (isSuspicious && flagReason) {
        await client.query(
          `INSERT INTO agent_payment_flags (agent_id, submission_id, flag_type, description)
           VALUES ($1, $2, $3, $4)`,
          [agentId, rows[0].id, 'partial', flagReason]
        );
      }

      // Update wallet: increment total_collected
      await client.query(
        `INSERT INTO agent_wallet (agent_id, total_collected)
           VALUES ($1, $2)
           ON CONFLICT (agent_id) DO UPDATE
           SET total_collected = agent_wallet.total_collected + $2,
               updated_at      = NOW()`,
        [agentId, submittedAmt]
      );

      await client.query('COMMIT');

      const submission = rows[0];

      // Admin notification (non-blocking)
      db.query(
        `SELECT sa.name AS agent_name, s.name AS shop_name
           FROM sales_agents sa, shops s
          WHERE sa.id = $1 AND s.id = $2`,
        [agentId, shop_id]
      ).then(({ rows: nr }) => {
        const agentName = nr[0]?.agent_name || `Agent #${agentId}`;
        const shopName  = nr[0]?.shop_name  || `Shop #${shop_id}`;
        if (isSuspicious) {
          createAdminNotification(
            ADMIN_TYPES.PAYMENT_SUSPICIOUS,
            'Suspicious Payment Submitted',
            `${agentName} submitted LKR ${submittedAmt.toLocaleString()} for "${shopName}" — expected LKR ${(shopExpected || 0).toLocaleString()}`,
            'critical',
            { agent_id: agentId, shop_id, submitted: submittedAmt, expected: shopExpected }
          );
          // Recalculate risk score after suspicious payment
          recalculateRiskScore(agentId);
        } else {
          createAdminNotification(
            ADMIN_TYPES.PAYMENT_SUBMITTED,
            'Payment Pending Verification',
            `${agentName} submitted LKR ${submittedAmt.toLocaleString()} for "${shopName}"`,
            'high',
            { agent_id: agentId, shop_id, amount: submittedAmt }
          );
        }
      }).catch(() => {});

      res.status(201).json(submission);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
      SELECT ac.id,
             ac.shop_id,
             ac.commission_type,
             ac.amount,
             ac.status,
             ac.month,
             ac.earned_date,
             ac.paid_at,
             ac.payment_method,
             ac.transaction_reference,
             ac.notes,
             ac.created_at,
             s.name AS shop_name
        FROM agent_commissions ac
        JOIN shops s ON s.id = ac.shop_id
       WHERE ac.agent_id = $1
       ORDER BY COALESCE(ac.earned_date, ac.created_at::DATE) DESC, ac.id DESC
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

// ── GET /api/agents/me/plans ──────────────────────────────────
async function listPlans(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, base_monthly_price, discount_3m, discount_6m, discount_12m, features, limits
         FROM subscription_plans
        WHERE is_active = TRUE
        ORDER BY sort_order`
    );
    res.json(rows);
  } catch (err) {
    console.error('agent listPlans error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/agents/me/shops/register ───────────────────────
// Full shop registration with location, owner details, reference ID
async function registerShop(req, res) {
  const agentId = req.agent.id;
  const {
    shop_name, owner_name, contact_number,
    location_lat, location_lng, location_map_url,
    selfie_url,
    br_number, district,
    // Login credentials for the shop owner
    email, username, password,
    shop_type = 'retail',
  } = req.body;

  if (!shop_name || !owner_name || !contact_number) {
    return res.status(400).json({ error: 'shop_name, owner_name, and contact_number are required' });
  }
  if (!location_map_url) {
    return res.status(400).json({ error: 'Google Maps link is required' });
  }
  const MAPS_RE = /^https?:\/\/(www\.)?(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i;
  if (!MAPS_RE.test(location_map_url)) {
    return res.status(400).json({ error: 'Please provide a valid Google Maps link' });
  }
  if (!selfie_url) {
    return res.status(400).json({ error: 'Shop selfie is required' });
  }
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username, and password are required for shop login' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Generate unique shop reference ID
    const refResult = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM shops`);
    const nextId    = refResult.rows[0].next_id;
    const shopRefId = `SHP-${String(nextId).padStart(6, '0')}`;

    const { rows: shopRows } = await client.query(
      `INSERT INTO shops
         (name, owner_name, email, phone, contact_number,
          location_lat, location_lng, location_map_url,
          selfie_url, br_number, district, shop_reference_id,
          subscription_status, activation_status,
          onboarded_by_agent_id, shop_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending_payment','inactive',$13,$14)
       RETURNING id, name, owner_name, email, shop_reference_id, activation_status,
                 subscription_status, contact_number, location_map_url,
                 selfie_url, br_number, district, created_at`,
      [
        shop_name.trim(), owner_name.trim(),
        email.toLowerCase().trim(), contact_number, contact_number,
        location_lat || null, location_lng || null, location_map_url,
        selfie_url, br_number || null, district || null, shopRefId,
        agentId, shop_type,
      ]
    );
    const shop = shopRows[0];

    // Create owner login account
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (shop_id, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [shop.id, username.trim(), email.toLowerCase().trim(), passwordHash]
    );

    // Onboarding commission (pending until first payment verified)
    await client.query(
      `INSERT INTO agent_commissions (agent_id, shop_id, commission_type, amount, status, earned_date)
       VALUES ($1, $2, 'onboarding', 500, 'pending', CURRENT_DATE)`,
      [agentId, shop.id]
    );

    await client.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING`,
      [agentId]
    );

    await client.query('COMMIT');

    // Admin notification (non-blocking)
    db.query(`SELECT name FROM sales_agents WHERE id = $1`, [agentId])
      .then(({ rows }) => {
        const agentName = rows[0]?.name || `Agent #${agentId}`;
        createAdminNotification(
          ADMIN_TYPES.SHOP_ONBOARDED,
          'New Shop Registered',
          `${agentName} registered shop "${shop_name}" (Ref: ${shopRefId})`,
          'high',
          { agent_id: agentId, shop_id: shop.id, shop_reference_id: shopRefId }
        );
      })
      .catch(() => {});

    res.status(201).json({
      ...shop,
      generated_username: username.trim(),
      generated_password: password,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('username')) return res.status(409).json({ error: 'That username is already taken' });
      if (detail.includes('email'))    return res.status(409).json({ error: 'A shop with this email already exists' });
      return res.status(409).json({ error: 'Duplicate entry' });
    }
    console.error('agent registerShop error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── GET /api/agents/me/shops ──────────────────────────────────
// List shops registered by this agent (with new fields)
async function listShops(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.name, s.owner_name, s.email, s.contact_number,
             s.shop_reference_id, s.activation_status,
             s.location_lat, s.location_lng, s.location_map_url,
             s.selfie_url, s.br_number, s.district, s.subscription_status, s.subscription_end_date,
             s.plan_id, sp.name AS plan_name, s.created_at,
             (SELECT COUNT(*) FROM shop_payment_proofs WHERE shop_id = s.id AND status = 'pending') AS pending_proofs
        FROM shops s
        LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.onboarded_by_agent_id = $1
         AND COALESCE(s.is_deleted, FALSE) = FALSE
       ORDER BY s.created_at DESC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent listShops error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/agents/me/shops/:shopId/payment-qr ─────────────
// Agent generates a real HelaPOS QR so they can pay on behalf of the shop.
// On payment: fulfillBillingPayment activates the shop automatically.
async function generateShopPaymentQR(req, res) {
  const agentId = req.agent.id;
  const shopId  = parseInt(req.params.shopId, 10);

  try {
    // Verify shop belongs to this agent
    const { rows: shopRows } = await db.query(
      `SELECT id, name, shop_reference_id, activation_status FROM shops
        WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shopId, agentId]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    const shop = shopRows[0];

    if (shop.activation_status === 'active') {
      return res.status(400).json({ error: 'Shop is already active' });
    }

    // Cancel any existing pending shop-payment QR for this shop
    await db.query(
      `UPDATE qr_payment_sessions
          SET payment_status = -3
        WHERE shop_id = $1 AND session_type = 'billing' AND payment_status = 0`,
      [shopId]
    );

    const amount    = 2500;
    const reference = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      const { qr_data, qr_reference } = await sysHelaPOS.generateBillingQR(reference, amount);

      // Create payment proof record
      const { rows: proofRows } = await db.query(
        `INSERT INTO shop_payment_proofs
           (shop_id, agent_id, amount, payment_method, qr_reference, month_paid_for, status)
         VALUES ($1, $2, $3, 'agent_helaPay', $4, DATE_TRUNC('month', NOW()), 'pending')
         RETURNING id`,
        [shopId, agentId, amount, qr_reference]
      );
      const proofId = proofRows[0].id;

      // Create QR session — session_type='billing' wires into fulfillBillingPayment
      await db.query(
        `INSERT INTO qr_payment_sessions
           (shop_id, agent_id, reference, qr_reference, qr_data, amount,
            session_type, billing_proof_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'billing', $7, $8)`,
        [shopId, agentId, reference, qr_reference, qr_data, amount, proofId, expiresAt]
      );

      res.json({ reference, qr_data, amount, shop_name: shop.name, expires_at: expiresAt });
    } catch (err) {
      const isMissingConfig = err.message?.includes('not configured');
      res.status(isMissingConfig ? 503 : 500).json({
        error: isMissingConfig
          ? 'HelaPay QR payments are not yet configured on this server. Please contact your administrator.'
          : (err.message || 'Failed to generate QR'),
      });
    }
  } catch (err) {
    console.error('generateShopPaymentQR error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/shops/:shopId/payment-qr/status/:reference ─
async function getShopPaymentQRStatus(req, res) {
  const agentId       = req.agent.id;
  const shopId        = parseInt(req.params.shopId, 10);
  const { reference } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, qr_reference, payment_status, amount, expires_at, billing_proof_id
         FROM qr_payment_sessions
        WHERE reference = $1 AND shop_id = $2 AND session_type = 'billing'`,
      [reference, shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];

    if (session.payment_status !== 0) {
      return res.json({ payment_status: session.payment_status, amount: session.amount, expires_at: session.expires_at });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.json({ payment_status: -2, amount: session.amount, expires_at: session.expires_at });
    }

    // 12s cooldown between HelaPOS API calls
    const lastCall = SHOP_PAY_COOLDOWN.get(reference) || 0;
    if (Date.now() - lastCall < 12_000) {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
    SHOP_PAY_COOLDOWN.set(reference, Date.now());

    try {
      const { payment_status } = await sysHelaPOS.checkBillingQRStatus(reference, session.qr_reference);
      if (payment_status === 2 || payment_status === -1) {
        await db.query(
          `UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW()
            WHERE id = $2 AND payment_status = 0`,
          [payment_status, session.id]
        );
        if (payment_status === 2 && session.billing_proof_id) {
          const { fulfillBillingPayment } = require('./shopPaymentController');
          fulfillBillingPayment(session.billing_proof_id, shopId, session.qr_reference)
            .catch((e) => console.error('[ShopPayQR] fulfil error:', e.message));
          SHOP_PAY_COOLDOWN.delete(reference);
        }
      }
      return res.json({ payment_status, amount: session.amount, expires_at: session.expires_at });
    } catch {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
  } catch (err) {
    console.error('getShopPaymentQRStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/shops/:shopId/payments ─────────────────
async function listShopPayments(req, res) {
  const agentId = req.agent.id;
  const shopId  = parseInt(req.params.shopId, 10);
  try {
    const check = await db.query(
      `SELECT id FROM shops WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shopId, agentId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const { rows } = await db.query(
      `SELECT * FROM shop_payment_proofs WHERE shop_id = $1 ORDER BY created_at DESC`,
      [shopId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listShopPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/agents/me/subscriptions ─────────────────────────
// All onboarded shops with subscription details, last payment, follow-up note
async function getSubscriptions(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(`
      SELECT
        s.id, s.name, s.owner_name, s.phone, s.email,
        s.activation_status, s.subscription_status, s.subscription_end_date,
        sp.name AS plan_name,
        (
          SELECT MAX(spp.created_at)
            FROM shop_payment_proofs spp
           WHERE spp.shop_id = s.id AND spp.status = 'verified'
        ) AS last_payment_date,
        COALESCE(asn.note, '') AS follow_up_note
      FROM shops s
      LEFT JOIN subscription_plans sp  ON sp.id  = s.plan_id
      LEFT JOIN agent_shop_notes   asn ON asn.shop_id = s.id AND asn.agent_id = $1
      WHERE s.onboarded_by_agent_id = $1
      ORDER BY s.name ASC
    `, [agentId]);
    res.json(rows);
  } catch (err) {
    console.error('agent getSubscriptions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/agents/me/shops/:shopId/note ─────────────────────
async function saveShopNote(req, res) {
  const agentId = req.agent.id;
  const shopId  = parseInt(req.params.shopId, 10);
  const { note } = req.body;
  if (typeof note !== 'string') return res.status(400).json({ error: 'note is required' });

  try {
    // Verify shop belongs to this agent
    const { rows } = await db.query(
      `SELECT id FROM shops WHERE id = $1 AND onboarded_by_agent_id = $2`,
      [shopId, agentId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    await db.query(`
      INSERT INTO agent_shop_notes (agent_id, shop_id, note, updated_at)
           VALUES ($1, $2, $3, NOW())
      ON CONFLICT (agent_id, shop_id)
        DO UPDATE SET note = EXCLUDED.note, updated_at = NOW()
    `, [agentId, shopId, note.trim()]);

    res.json({ ok: true });
  } catch (err) {
    console.error('saveShopNote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Agent deposit / self-payment ──────────────────────────────
const { randomUUID } = require('crypto');
const sysHelaPOS     = require('../services/systemHelaposService');

const DEPOSIT_AMOUNT  = 2500;
const DEPOSIT_CREDIT  = 500;
const DEPOSIT_COOLDOWN     = new Map(); // reference → last-poll timestamp
const SHOP_PAY_COOLDOWN    = new Map(); // reference → last-poll timestamp

// POST /api/agents/me/deposit/generate-qr
async function generateDepositQR(req, res) {
  const agentId = req.agent.id;
  try {
    // Cancel any existing pending deposit session for this agent
    await db.query(
      `UPDATE qr_payment_sessions
          SET payment_status = -1, updated_at = NOW()
        WHERE agent_id = $1 AND session_type = 'agent_deposit' AND payment_status = 0`,
      [agentId]
    );

    const reference = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { qr_data, qr_reference } = await sysHelaPOS.generateBillingQR(reference, DEPOSIT_AMOUNT);

    // Create QR session (no shop_id for agent deposits)
    await db.query(
      `INSERT INTO qr_payment_sessions
         (agent_id, reference, qr_reference, qr_data, amount, session_type, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'agent_deposit', $6)`,
      [agentId, reference, qr_reference, qr_data, DEPOSIT_AMOUNT, expiresAt]
    );

    // Create pending self-payment record
    await db.query(
      `INSERT INTO agent_self_payments (agent_id, amount_paid, credited, reference, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (reference) DO NOTHING`,
      [agentId, DEPOSIT_AMOUNT, DEPOSIT_CREDIT, reference]
    );

    // Ensure wallet row exists
    await db.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING`,
      [agentId]
    );

    res.json({ reference, qr_data, expires_at: expiresAt, amount: DEPOSIT_AMOUNT });
  } catch (err) {
    console.error('generateDepositQR error:', err);
    const isMissingConfig = err.message?.includes('not configured');
    res.status(isMissingConfig ? 503 : 500).json({
      error: isMissingConfig
        ? 'HelaPay QR payments are not yet configured on this server. Please contact your administrator.'
        : (err.message || 'Failed to generate QR'),
    });
  }
}

// GET /api/agents/me/deposit/status/:reference
async function getDepositQRStatus(req, res) {
  const agentId   = req.agent.id;
  const { reference } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT id, reference, qr_reference, payment_status, expires_at, amount
         FROM qr_payment_sessions
        WHERE reference = $1 AND agent_id = $2 AND session_type = 'agent_deposit'`,
      [reference, agentId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];

    if (session.payment_status !== 0) {
      return res.json({ payment_status: session.payment_status, amount: session.amount });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.json({ payment_status: -2, amount: session.amount });
    }

    // Cooldown: one HelaPOS call per 12s
    const lastCall = DEPOSIT_COOLDOWN.get(reference) || 0;
    if (Date.now() - lastCall < 12_000) {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
    DEPOSIT_COOLDOWN.set(reference, Date.now());

    try {
      const { payment_status } = await sysHelaPOS.checkBillingQRStatus(reference, session.qr_reference);
      if (payment_status === 2) {
        await fulfillAgentDeposit(session.id, agentId, reference);
      }
      return res.json({ payment_status, amount: session.amount, expires_at: session.expires_at });
    } catch {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
  } catch (err) {
    console.error('getDepositQRStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/agents/me/deposit/history
async function getDepositHistory(req, res) {
  const agentId = req.agent.id;
  try {
    // Ensure wallet row exists so the balance query never returns empty
    await db.query(
      `INSERT INTO agent_wallet (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING`,
      [agentId]
    );

    const [{ rows: history }, { rows: wallet }] = await Promise.all([
      db.query(
        `SELECT id, amount_paid, credited, reference, status, paid_at, created_at
           FROM agent_self_payments
          WHERE agent_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        [agentId]
      ),
      db.query(
        `SELECT COALESCE(balance, 0) AS balance FROM agent_wallet WHERE agent_id = $1`,
        [agentId]
      ),
    ]);
    res.json({ balance: parseFloat(wallet[0]?.balance || 0), history });
  } catch (err) {
    console.error('getDepositHistory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Idempotent fulfillment — called by both webhook and status poll
async function fulfillAgentDeposit(sessionId, agentId, reference) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock and check status atomically
    const { rows } = await client.query(
      `SELECT id, status FROM agent_self_payments WHERE reference = $1 FOR UPDATE`,
      [reference]
    );
    if (!rows.length || rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return; // already fulfilled or missing
    }

    // Mark payment completed
    await client.query(
      `UPDATE agent_self_payments SET status = 'completed', paid_at = NOW() WHERE reference = $1`,
      [reference]
    );

    // Credit balance to agent wallet (upsert-safe)
    await client.query(
      `INSERT INTO agent_wallet (agent_id, balance, updated_at)
            VALUES ($1, $2, NOW())
       ON CONFLICT (agent_id)
         DO UPDATE SET balance    = agent_wallet.balance + $2,
                       updated_at = NOW()`,
      [agentId, DEPOSIT_CREDIT]
    );

    // Mark QR session as paid
    await client.query(
      `UPDATE qr_payment_sessions SET payment_status = 2, updated_at = NOW()
        WHERE id = $1 AND payment_status = 0`,
      [sessionId]
    );

    await client.query('COMMIT');
    DEPOSIT_COOLDOWN.delete(reference);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboard, listCustomers, onboardCustomer, editCustomer,
  submitPayment, listPayments, listCommissions, updateBankDetails, getRenewals,
  listPlans,
  uploadShopSelfie, registerShop, listShops, generateShopPaymentQR, getShopPaymentQRStatus, listShopPayments,
  getSubscriptions, saveShopNote,
  generateDepositQR, getDepositQRStatus, getDepositHistory, fulfillAgentDeposit,
};
