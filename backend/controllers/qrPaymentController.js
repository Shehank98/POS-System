const { randomUUID } = require('crypto');
const db             = require('../config/database');
const helapos        = require('../services/helaposService');
const { notifyShopQRPayment } = require('../websocket');
const { sendToTopic } = require('../utils/fcm');
const { fulfillBillingPayment } = require('./shopPaymentController');

// Prevent hammering HelaPOS — at most one getSaleStatus call per session per 12 s.
// Key: reference (our UUID), Value: timestamp of last HelaPOS call.
const helaposCallCooldown = new Map();

// GET /api/qr/config  (owner only)
async function getConfig(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT app_id, business_id, (access_token IS NOT NULL) AS configured FROM shop_helapos_config WHERE shop_id = $1',
      [req.shopId]
    );
    if (!rows.length) return res.json({ configured: false });
    res.json({ ...rows[0], configured: true });
  } catch (err) {
    console.error('[QR] getConfig error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/qr/config  (owner only)
async function saveConfig(req, res) {
  const { app_id, app_secret, business_id } = req.body;
  if (!app_id || !app_secret || !business_id) {
    return res.status(400).json({ error: 'app_id, app_secret and business_id are required' });
  }
  try {
    await db.query(
      `INSERT INTO shop_helapos_config (shop_id, app_id, app_secret, business_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (shop_id) DO UPDATE
         SET app_id = $2, app_secret = $3, business_id = $4,
             access_token = NULL, refresh_token = NULL, token_expires_at = NULL,
             updated_at = NOW()`,
      [req.shopId, app_id, app_secret, business_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[QR] saveConfig error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/qr/generate  (authenticated staff)
async function generateQR(req, res) {
  const { amount, session_type = 'pos', pre_order_id } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }
  try {
    const { rows: cfgRows } = await db.query(
      'SELECT business_id FROM shop_helapos_config WHERE shop_id = $1',
      [req.shopId]
    );
    if (!cfgRows.length) {
      return res.status(400).json({ error: 'HelaPOS not configured. Please set up credentials in Settings.' });
    }
    const { business_id } = cfgRows[0];
    const reference = randomUUID();

    const { qr_data, qr_reference } = await helapos.generateQR(
      req.shopId, business_id, reference, Number(amount)
    );

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store qr_data so the mobile display page can render it
    await db.query(
      `INSERT INTO qr_payment_sessions
         (shop_id, reference, qr_reference, qr_data, amount, session_type, pre_order_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.shopId, reference, qr_reference, qr_data, Number(amount), session_type, pre_order_id || null, expiresAt]
    );

    res.json({ reference, qr_data, qr_reference, expires_at: expiresAt });
  } catch (err) {
    console.error('[QR] generateQR error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate QR' });
  }
}

// POST /api/qr/webhook  (public — called by HelaPOS)
//
// HelaPOS webhook payload:
// {
//   "statusCode": "200",
//   "reference": "<our UUID>",     ← field name is 'reference', not 'qr_reference'
//   "sale": { "payment_status": 2, "amount": 1500, ... }
// }
async function handleWebhook(req, res) {
  // Always acknowledge immediately — HelaPOS expects 200 fast
  res.json({ received: true });

  try {
    const body      = req.body || {};
    // HelaPOS sends OUR reference (the UUID we passed as 'r' when generating the QR)
    const ourRef    = body.reference;
    const payStatus = body.sale?.payment_status ?? body.payment_status;

    console.log('[QR] webhook received:', JSON.stringify({ ourRef, payStatus, body }));

    if (!ourRef || payStatus === undefined || payStatus === null) {
      console.warn('[QR] webhook missing reference or payment_status');
      return;
    }

    // HelaPOS sends their internal qr_reference as the webhook "reference" field,
    // NOT the UUID we passed as "r". Match on either column.
    const { rows } = await db.query(
      `SELECT id, shop_id, reference, qr_reference, payment_status, session_type, billing_proof_id
         FROM qr_payment_sessions
        WHERE reference = $1 OR qr_reference = $1`,
      [ourRef]
    );
    if (!rows.length) {
      console.warn('[QR] webhook: no session found for reference', ourRef);
      return;
    }

    const session = rows[0];

    // Idempotent: only update if still pending (avoids double-webhook issues)
    if (session.payment_status !== 0) {
      console.log('[QR] webhook: session already settled, ignoring');
      return;
    }

    await db.query(
      'UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2 AND payment_status = 0',
      [payStatus, session.id]
    );

    helaposCallCooldown.delete(session.reference);

    // ── Billing QR: activate shop when paid ──────────────────
    if (session.session_type === 'billing' && payStatus === 2 && session.billing_proof_id) {
      fulfillBillingPayment(session.billing_proof_id, session.shop_id, session.qr_reference)
        .catch((e) => console.error('[QR] webhook billing fulfil error:', e.message));

      // Notify the shop frontend via WebSocket so the billing page updates live
      notifyShopQRPayment(session.shop_id, {
        reference:      session.reference,
        payment_status: payStatus,
        session_type:   'billing',
      });
      return; // skip generic POS notification below
    }

    // ── POS QR: standard notification path ───────────────────
    notifyShopQRPayment(session.shop_id, {
      reference:      session.reference,
      payment_status: payStatus,
    });

    if (payStatus === 2) {
      sendToTopic(
        `shop_${session.shop_id}_alerts`,
        'QR Payment Received',
        `Payment confirmed — Ref: ${session.reference.slice(0, 8).toUpperCase()}`,
        { type: 'qr_payment', reference: session.reference, payment_status: '2' }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[QR] handleWebhook processing error:', err.message);
  }
}

// GET /api/qr/status/:reference  (authenticated staff — polled every 3s by frontend)
async function checkStatus(req, res) {
  const { reference } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM qr_payment_sessions WHERE reference = $1 AND shop_id = $2',
      [reference, req.shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];

    // Already settled — return immediately without calling HelaPOS
    if (session.payment_status !== 0) {
      return res.json({
        payment_status: session.payment_status,
        amount:         session.amount,
        expires_at:     session.expires_at,
      });
    }

    // Expired — no point calling HelaPOS
    if (new Date(session.expires_at) < new Date()) {
      return res.json({ payment_status: -2, amount: session.amount, expires_at: session.expires_at });
    }

    // Still pending: call HelaPOS as fallback (webhook + WebSocket is primary).
    // Cooldown: one HelaPOS call per session per 12 s to avoid rate-limiting.
    const lastCall = helaposCallCooldown.get(reference) || 0;
    if (Date.now() - lastCall < 12_000) {
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
    helaposCallCooldown.set(reference, Date.now());

    try {
      const { rows: cfgRows } = await db.query(
        'SELECT business_id FROM shop_helapos_config WHERE shop_id = $1',
        [req.shopId]
      );
      const businessId = cfgRows[0]?.business_id;
      if (!businessId) {
        return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
      }
      const { payment_status } = await helapos.checkPaymentStatus(
        req.shopId, businessId, reference, session.qr_reference
      );
      // Only persist terminal statuses — ignore 0 (pending) and anything unexpected
      // (e.g. HelaPOS error codes that slipped through the parser).
      if (payment_status === 2 || payment_status === -1) {
        // Atomic update — only if still pending to avoid race with webhook
        await db.query(
          'UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2 AND payment_status = 0',
          [payment_status, session.id]
        );
        if (payment_status === 2) {
          notifyShopQRPayment(req.shopId, { reference, payment_status });
        }
      }
      return res.json({ payment_status, amount: session.amount, expires_at: session.expires_at });
    } catch (helaErr) {
      console.error('[QR] getSaleStatus error (reference:', reference, '):', helaErr.message);
      return res.json({ payment_status: 0, amount: session.amount, expires_at: session.expires_at });
    }
  } catch (err) {
    console.error('[QR] checkStatus error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/qr/display/:reference  (public — mobile customer display)
async function getDisplayStatus(req, res) {
  const { reference } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT qr_data, amount, payment_status, expires_at FROM qr_payment_sessions WHERE reference = $1',
      [reference]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = rows[0];
    res.json({
      qr_data:        s.qr_data,
      amount:         s.amount,
      payment_status: s.payment_status,
      expires_at:     s.expires_at,
    });
  } catch (err) {
    console.error('[QR] getDisplayStatus error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/qr/test  (owner only — verify HelaPOS credentials work)
async function testConnection(req, res) {
  try {
    const token = await helapos.getOrRefreshToken(req.shopId);
    if (!token) throw new Error('No token returned');
    res.json({ success: true, message: 'Connected to HelaPOS successfully' });
  } catch (err) {
    console.error('[QR] testConnection error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = { getConfig, saveConfig, generateQR, handleWebhook, checkStatus, getDisplayStatus, testConnection };
