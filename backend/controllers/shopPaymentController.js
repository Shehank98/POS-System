const { randomUUID } = require('crypto');
const db             = require('../config/database');
const { uploadFile } = require('../utils/storageService');
const sysHelaPOS     = require('../services/systemHelaposService');
const { notifyAgent } = require('../websocket');

const BILLING_QR_COOLDOWN = new Map(); // reference → timestamp of last status check

// ── POST /api/shop-payments/upload-proof ─────────────────────
// Shop owner uploads a payment proof (bank slip photo)
// Authenticated as a shop user (req.user available via auth middleware)
async function uploadPaymentProof(req, res) {
  const shopId = req.user.shop_id;
  const { fileData, month_paid_for } = req.body;

  if (!fileData) return res.status(400).json({ error: 'fileData is required' });

  try {
    const ext  = fileData.startsWith('data:image/png') ? 'png' : 'jpg';
    const dest = `shops/${shopId}/payment_proof_${Date.now()}.${ext}`;
    const url  = await uploadFile(fileData, dest);

    // Determine month
    const month = month_paid_for || new Date().toISOString().slice(0, 7) + '-01';

    // Check if there's already a pending/verified proof for this month
    const { rows: existing } = await db.query(
      `SELECT id, status FROM shop_payment_proofs
        WHERE shop_id = $1
          AND DATE_TRUNC('month', month_paid_for) = DATE_TRUNC('month', $2::DATE)
          AND status IN ('pending','verified')`,
      [shopId, month]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'A payment proof for this month already exists',
        existing_status: existing[0].status,
      });
    }

    const { rows } = await db.query(
      `INSERT INTO shop_payment_proofs
         (shop_id, amount, payment_method, proof_url, month_paid_for, status)
       VALUES ($1, 2500, 'bank_transfer', $2, DATE_TRUNC('month', $3::DATE), 'pending')
       RETURNING id, shop_id, amount, payment_method, proof_url, month_paid_for, status, created_at`,
      [shopId, url, month]
    );

    res.status(201).json({
      message: 'Payment proof submitted. Your account will be activated after admin verification.',
      proof: rows[0],
    });
  } catch (err) {
    console.error('uploadPaymentProof error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/shop-payments/my-proofs ─────────────────────────
async function listMyProofs(req, res) {
  const shopId = req.user.shop_id;
  try {
    const { rows } = await db.query(
      `SELECT id, amount, payment_method, proof_url, qr_reference,
              month_paid_for, status, admin_note, reviewed_at, created_at
         FROM shop_payment_proofs
        WHERE shop_id = $1
        ORDER BY created_at DESC`,
      [shopId]
    );
    res.json(rows);
  } catch (err) {
    console.error('listMyProofs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/shop-payments ─────────────────────────────
async function adminListShopPayments(req, res) {
  const { status } = req.query;
  try {
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE spp.status = $1`; }

    const { rows } = await db.query(`
      SELECT spp.*,
             s.name AS shop_name, s.owner_name, s.shop_reference_id,
             s.activation_status, s.subscription_status,
             s.selfie_url AS shop_selfie_url,
             sa.id     AS agent_id_info,
             sa.name   AS agent_name,
             sa.phone  AS agent_phone,
             sa.email  AS agent_email,
             sa.district AS agent_district,
             (
               SELECT ac.status FROM agent_commissions ac
                WHERE ac.shop_id = spp.shop_id AND ac.commission_type = 'onboarding'
                ORDER BY ac.created_at DESC LIMIT 1
             ) AS onboarding_commission_status,
             (
               SELECT ac.amount FROM agent_commissions ac
                WHERE ac.shop_id = spp.shop_id AND ac.commission_type = 'onboarding'
                ORDER BY ac.created_at DESC LIMIT 1
             ) AS onboarding_commission_amount
        FROM shop_payment_proofs spp
        JOIN shops s ON s.id = spp.shop_id
        LEFT JOIN sales_agents sa ON sa.id = COALESCE(spp.agent_id, s.onboarded_by_agent_id)
       ${where}
       ORDER BY spp.created_at DESC
       LIMIT 500
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('adminListShopPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/shop-payments/:id/verify ──────────────────
// Verify proof → activate shop account
async function adminVerifyShopPayment(req, res) {
  const proofId = parseInt(req.params.id, 10);
  const client  = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: proofRows } = await client.query(
      `SELECT * FROM shop_payment_proofs WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [proofId]
    );
    if (proofRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Proof not found or already processed' });
    }
    const proof = proofRows[0];

    // Read shop info + check for a pending onboarding commission
    const { rows: shopStatusRows } = await client.query(
      `SELECT activation_status, onboarded_by_agent_id, name FROM shops WHERE id = $1 FOR UPDATE`,
      [proof.shop_id]
    );
    const shopName = shopStatusRows[0]?.name || `Shop #${proof.shop_id}`;
    const agentId  = proof.agent_id || shopStatusRows[0]?.onboarded_by_agent_id;

    // Determine first vs renewal: prefer checking for a pending/locked onboarding
    // commission rather than activation_status (which defaults to 'active' for
    // older onboardCustomer-created shops even before first payment).
    let hasUnlockableOnboarding = false;
    if (agentId) {
      const { rows: obRows } = await client.query(
        `SELECT id FROM agent_commissions
          WHERE agent_id = $1 AND shop_id = $2
            AND commission_type = 'onboarding'
            AND status IN ('pending','locked')
          LIMIT 1`,
        [agentId, proof.shop_id]
      );
      hasUnlockableOnboarding = obRows.length > 0;
    }

    // Activate shop — extend from current end date if in the future, else from now
    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              subscription_end_date = CASE
                WHEN subscription_end_date IS NOT NULL AND subscription_end_date > NOW()
                  THEN subscription_end_date + INTERVAL '1 month'
                ELSE NOW() + INTERVAL '1 month'
              END
        WHERE id = $1`,
      [proof.shop_id]
    );

    // Mark proof as verified
    await client.query(
      `UPDATE shop_payment_proofs
          SET status = 'verified', reviewed_at = NOW()
        WHERE id = $1`,
      [proofId]
    );

    // Commissions
    if (agentId) {
      if (hasUnlockableOnboarding) {
        await client.query(
          `UPDATE agent_commissions
              SET status = 'approved', approved_at = NOW()
            WHERE agent_id = $1 AND shop_id = $2
              AND commission_type = 'onboarding'
              AND status IN ('pending', 'locked')`,
          [agentId, proof.shop_id]
        );
      } else {
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        await client.query(
          `INSERT INTO agent_commissions
             (agent_id, shop_id, commission_type, amount, month, status, earned_date, payment_method)
           VALUES ($1, $2, 'monthly', 500, $3::DATE, 'approved', CURRENT_DATE, 'bank_transfer')
           ON CONFLICT (agent_id, shop_id, commission_type, month) WHERE month IS NOT NULL DO NOTHING`,
          [agentId, proof.shop_id, currentMonth]
        );
      }
    }

    await client.query('COMMIT');

    // Notify agent via WebSocket (non-blocking)
    if (agentId) {
      try {
        notifyAgent(agentId, {
          event:     'shop_activated',
          shop_id:   proof.shop_id,
          shop_name: shopName,
          method:    'bank_proof',
        });
      } catch {}
    }

    res.json({ message: 'Payment verified. Shop account has been activated.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adminVerifyShopPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── PUT /api/admin/shop-payments/:id/reject ──────────────────
async function adminRejectShopPayment(req, res) {
  const { admin_note } = req.body;
  const proofId = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await db.query(
      `UPDATE shop_payment_proofs
          SET status = 'rejected', admin_note = $1, reviewed_at = NOW()
        WHERE id = $2 AND status = 'pending'`,
      [admin_note || null, proofId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Proof not found or already processed' });
    res.json({ message: 'Payment proof rejected' });
  } catch (err) {
    console.error('adminRejectShopPayment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/shop-payments/:id/helaPay-verify ──────────
// Admin confirms a HelaPay QR payment was completed
async function adminVerifyHelaPay(req, res) {
  const proofId = parseInt(req.params.id, 10);
  const client  = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM shop_payment_proofs
        WHERE id = $1 AND payment_method IN ('agent_helaPay','helaPay') AND status = 'pending' FOR UPDATE`,
      [proofId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'HelaPay proof not found or already processed' });
    }
    const proof = rows[0];

    const { rows: shopStatusRows } = await client.query(
      `SELECT onboarded_by_agent_id FROM shops WHERE id = $1 FOR UPDATE`,
      [proof.shop_id]
    );
    const agentId = proof.agent_id || shopStatusRows[0]?.onboarded_by_agent_id;

    let hasUnlockableOnboarding = false;
    if (agentId) {
      const { rows: obRows } = await client.query(
        `SELECT id FROM agent_commissions
          WHERE agent_id = $1 AND shop_id = $2
            AND commission_type = 'onboarding'
            AND status IN ('pending','locked')
          LIMIT 1`,
        [agentId, proof.shop_id]
      );
      hasUnlockableOnboarding = obRows.length > 0;
    }

    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              subscription_end_date = CASE
                WHEN subscription_end_date IS NOT NULL AND subscription_end_date > NOW()
                  THEN subscription_end_date + INTERVAL '1 month'
                ELSE NOW() + INTERVAL '1 month'
              END
        WHERE id = $1`,
      [proof.shop_id]
    );

    await client.query(
      `UPDATE shop_payment_proofs SET status = 'verified', reviewed_at = NOW() WHERE id = $1`,
      [proofId]
    );

    if (agentId) {
      if (hasUnlockableOnboarding) {
        await client.query(
          `UPDATE agent_commissions
              SET status = 'approved'
            WHERE agent_id = $1 AND shop_id = $2
              AND commission_type = 'onboarding'
              AND status IN ('pending', 'locked')`,
          [agentId, proof.shop_id]
        );
      } else {
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        await client.query(
          `INSERT INTO agent_commissions
             (agent_id, shop_id, commission_type, amount, month, status, earned_date, payment_method)
           VALUES ($1, $2, 'monthly', 500, $3::DATE, 'approved', CURRENT_DATE, 'helapay')
           ON CONFLICT (agent_id, shop_id, commission_type, month) WHERE month IS NOT NULL DO NOTHING`,
          [agentId, proof.shop_id, currentMonth]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'HelaPay verified. Shop account activated.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adminVerifyHelaPay error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── POST /api/shop-payments/generate-billing-qr ──────────────
// Shop owner generates a HelaPOS QR code to pay the activation fee
async function generateBillingQR(req, res) {
  const shopId = req.user.shop_id;

  // Only inactive shops need to pay via this endpoint
  const { rows: shopRows } = await db.query(
    'SELECT activation_status, shop_reference_id, onboarded_by_agent_id FROM shops WHERE id = $1',
    [shopId]
  );
  if (!shopRows.length) return res.status(404).json({ error: 'Shop not found' });

  const shop = shopRows[0];
  if (shop.activation_status === 'active') {
    return res.status(400).json({ error: 'Shop is already active' });
  }

  // Cancel any existing pending billing QR for this shop
  await db.query(
    `UPDATE qr_payment_sessions
        SET payment_status = -3  -- cancelled
      WHERE shop_id = $1 AND session_type = 'billing' AND payment_status = 0`,
    [shopId]
  );

  const amount    = 2500; // LKR 2500 activation fee
  const reference = randomUUID();

  try {
    const { qr_data, qr_reference } = await sysHelaPOS.generateBillingQR(reference, amount);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Create a shop_payment_proofs record (pending, helaPay method)
    const { rows: proofRows } = await db.query(
      `INSERT INTO shop_payment_proofs
         (shop_id, agent_id, amount, payment_method, qr_reference, month_paid_for, status)
       VALUES ($1, $2, $3, 'helaPay', $4, DATE_TRUNC('month', NOW()), 'pending')
       RETURNING id`,
      [shopId, shop.onboarded_by_agent_id || null, amount, qr_reference]
    );
    const proofId = proofRows[0].id;

    // Create QR session linked to proof
    await db.query(
      `INSERT INTO qr_payment_sessions
         (shop_id, reference, qr_reference, qr_data, amount, session_type, billing_proof_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'billing', $6, $7)`,
      [shopId, reference, qr_reference, qr_data, amount, proofId, expiresAt]
    );

    res.json({ reference, qr_data, qr_reference, amount, expires_at: expiresAt });
  } catch (err) {
    console.error('[BillingQR] generateBillingQR error:', err.message);
    const isMissingConfig = err.message?.includes('not configured');
    res.status(isMissingConfig ? 503 : 500).json({
      error: isMissingConfig
        ? 'HelaPlay QR payments are not yet configured on this server. Please contact your administrator.'
        : (err.message || 'Failed to generate billing QR'),
    });
  }
}

// ── GET /api/shop-payments/billing-qr-status/:reference ──────
// Poll for billing QR payment status (shop-scoped)
async function getBillingQRStatus(req, res) {
  const { reference } = req.params;
  const shopId        = req.user.shop_id;

  try {
    const { rows } = await db.query(
      `SELECT id, qr_reference, payment_status, amount, expires_at, billing_proof_id
         FROM qr_payment_sessions
        WHERE reference = $1 AND shop_id = $2 AND session_type = 'billing'`,
      [reference, shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];

    // Settled or expired — return cached state
    if (session.payment_status !== 0) {
      return res.json({ payment_status: session.payment_status, amount: session.amount, expires_at: session.expires_at });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.json({ payment_status: -2, amount: session.amount, expires_at: session.expires_at });
    }

    // Cooldown: one HelaPOS check per session per 12s
    const lastCall = BILLING_QR_COOLDOWN.get(reference) || 0;
    if (Date.now() - lastCall < 12_000) {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
    BILLING_QR_COOLDOWN.set(reference, Date.now());

    try {
      const { payment_status } = await sysHelaPOS.checkBillingQRStatus(reference, session.qr_reference);
      if (payment_status === 2 || payment_status === -1) {
        await db.query(
          'UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2 AND payment_status = 0',
          [payment_status, session.id]
        );
        // Trigger billing fulfilment if paid
        if (payment_status === 2 && session.billing_proof_id) {
          fulfillBillingPayment(session.billing_proof_id, shopId, qr_reference_from_session(session)).catch(
            (e) => console.error('[BillingQR] fulfil error (from poll):', e.message)
          );
        }
      }
      return res.json({ payment_status, amount: session.amount, expires_at: session.expires_at });
    } catch {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
  } catch (err) {
    console.error('[BillingQR] getBillingQRStatus error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

function qr_reference_from_session(session) {
  return session.qr_reference || null;
}

// ── Shared billing fulfilment logic (called from webhook + poll) ──
// Idempotent: checks proof status before updating, wrapped in transaction
async function fulfillBillingPayment(proofId, shopId, qrReference) {
  const { createNotification } = require('./notificationController');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock proof row — bail if already verified (idempotent)
    const { rows: proofRows } = await client.query(
      `SELECT * FROM shop_payment_proofs WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [proofId]
    );
    if (!proofRows.length) {
      await client.query('ROLLBACK');
      return; // already processed
    }
    const proof = proofRows[0];

    // Lock shop row + check for pending onboarding commission
    await client.query(`SELECT id FROM shops WHERE id = $1 FOR UPDATE`, [shopId]);

    let hasUnlockableOnboarding = false;
    if (proof.agent_id) {
      const { rows: obRows } = await client.query(
        `SELECT id FROM agent_commissions
          WHERE agent_id = $1 AND shop_id = $2
            AND commission_type = 'onboarding'
            AND status IN ('pending','locked')
          LIMIT 1`,
        [proof.agent_id, shopId]
      );
      hasUnlockableOnboarding = obRows.length > 0;
    }

    // Mark proof verified
    await client.query(
      `UPDATE shop_payment_proofs
          SET status = 'verified', reviewed_at = NOW(),
              qr_reference = COALESCE(qr_reference, $1)
        WHERE id = $2`,
      [qrReference, proofId]
    );

    // Activate shop — extend from current end date if in the future, else from now
    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              subscription_end_date = CASE
                WHEN subscription_end_date IS NOT NULL AND subscription_end_date > NOW()
                  THEN subscription_end_date + INTERVAL '1 month'
                ELSE NOW() + INTERVAL '1 month'
              END
        WHERE id = $1`,
      [shopId]
    );

    // Commissions
    if (proof.agent_id) {
      if (hasUnlockableOnboarding) {
        await client.query(
          `UPDATE agent_commissions
              SET status = 'approved'
            WHERE agent_id = $1 AND shop_id = $2
              AND commission_type = 'onboarding'
              AND status IN ('pending', 'locked')`,
          [proof.agent_id, shopId]
        );
      } else {
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        await client.query(
          `INSERT INTO agent_commissions
             (agent_id, shop_id, commission_type, amount, month, status, earned_date, payment_method)
           VALUES ($1, $2, 'monthly', 500, $3::DATE, 'approved', CURRENT_DATE, 'helaPay')
           ON CONFLICT (agent_id, shop_id, commission_type, month) WHERE month IS NOT NULL DO NOTHING`,
          [proof.agent_id, shopId, currentMonth]
        );
      }
    }

    // Fetch shop name for notifications (before releasing client)
    const { rows: shopRows } = await client.query(
      `SELECT name, onboarded_by_agent_id FROM shops WHERE id = $1`,
      [shopId]
    );
    const shopName = shopRows[0]?.name || `Shop #${shopId}`;
    const agentId  = shopRows[0]?.onboarded_by_agent_id || proof.agent_id;

    await client.query('COMMIT');
    BILLING_QR_COOLDOWN.delete(proofId?.toString());

    // Notify agent via WebSocket (non-blocking)
    if (agentId) {
      try {
        notifyAgent(agentId, {
          event:     'shop_activated',
          shop_id:   shopId,
          shop_name: shopName,
          method:    'helaPay',
        });
      } catch {}
    }

    // Notify shop owner (non-blocking, outside transaction)
    try {
      await createNotification(
        shopId,
        'payment_verified',
        'Payment Confirmed — Account Activated!',
        'Your HelaPlay QR payment of LKR 2,500 has been confirmed. Your account is now active.',
        { method: 'helaPay', amount: 2500 }
      );
    } catch (e) {
      console.warn('[BillingQR] notification error:', e.message);
    }

    console.log(`[BillingQR] Fulfilled billing payment for shop ${shopId}, proof ${proofId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  uploadPaymentProof,
  listMyProofs,
  adminListShopPayments,
  adminVerifyShopPayment,
  adminRejectShopPayment,
  adminVerifyHelaPay,
  generateBillingQR,
  getBillingQRStatus,
  fulfillBillingPayment,
};
