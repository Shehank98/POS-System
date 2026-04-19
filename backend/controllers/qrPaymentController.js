const { v4: uuidv4 }      = require('uuid');
const db                  = require('../config/database');
const helapos             = require('../services/helaposService');
const { notifyShopQRPayment } = require('../websocket');

// ── GET /api/qr/config ────────────────────────────────────────
async function getConfig(req, res) {
  try {
    const cfg = await helapos.getConfig(req.shopId);
    if (!cfg) return res.json({ configured: false });
    res.json({
      configured:  true,
      app_id:      cfg.app_id,
      business_id: cfg.business_id,
      // never return the secret or tokens
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── PUT /api/qr/config ────────────────────────────────────────
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
    res.status(500).json({ error: err.message });
  }
}

// ── POST /api/qr/generate ─────────────────────────────────────
async function generateQR(req, res) {
  const { amount, session_type = 'pos', pre_order_id } = req.body;
  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: 'amount is required' });
  }

  const cfg = await helapos.getConfig(req.shopId);
  if (!cfg) {
    return res.status(400).json({ error: 'HelaPOS is not configured for this shop. Configure it in Settings.' });
  }

  const reference = uuidv4();
  const amt       = parseFloat(amount);

  try {
    const { qr_data, qr_reference } = await helapos.generateQR(
      req.shopId, cfg.business_id, reference, amt
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO qr_payment_sessions
         (shop_id, reference, qr_reference, qr_data, amount, session_type, pre_order_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.shopId, reference, qr_reference, qr_data, amt, session_type, pre_order_id || null, expiresAt]
    );

    res.json({ reference, qr_data, qr_reference, expires_at: expiresAt });
  } catch (err) {
    console.error('[QR] generateQR error:', err.message);
    res.status(502).json({ error: 'Failed to generate QR code. Please try again.' });
  }
}

// ── POST /api/qr/webhook  (public — HelaPOS calls this) ───────
async function handleWebhook(req, res) {
  // Respond immediately to satisfy HelaPOS's 200 OK requirement
  res.status(200).json({ received: true });

  try {
    const { reference, sale } = req.body;
    if (!reference || !sale) return;

    const paymentStatus = parseInt(sale.payment_status, 10);

    // Look up by our internal reference (sent as `r` when generating QR)
    const { rows } = await db.query(
      `SELECT * FROM qr_payment_sessions WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    if (!rows.length) return;

    const session = rows[0];
    await db.query(
      `UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
      [paymentStatus, session.id]
    );

    // Push real-time update to any connected POS terminals for this shop
    notifyShopQRPayment(session.shop_id, {
      reference:      session.reference,
      payment_status: paymentStatus,
      amount:         session.amount,
    });
  } catch (err) {
    console.error('[QR] webhook processing error:', err.message);
  }
}

// ── GET /api/qr/status/:reference ────────────────────────────
async function checkStatus(req, res) {
  const { reference } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT * FROM qr_payment_sessions WHERE reference = $1 AND shop_id = $2 LIMIT 1`,
      [reference, req.shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });

    const session = rows[0];

    // If already resolved, return from DB without calling HelaPOS
    if (session.payment_status === 2 || session.payment_status === -1) {
      return res.json({
        payment_status: session.payment_status,
        amount:         session.amount,
        reference:      session.reference,
      });
    }

    // If expired, mark failed
    if (new Date(session.expires_at) < new Date()) {
      await db.query(
        `UPDATE qr_payment_sessions SET payment_status = -1, updated_at = NOW() WHERE id = $1`,
        [session.id]
      );
      return res.json({ payment_status: -1, amount: session.amount, reference });
    }

    // Poll HelaPOS for latest status
    try {
      const result = await helapos.checkPaymentStatus(
        req.shopId, session.reference, session.qr_reference
      );
      const newStatus = parseInt(result.sale?.payment_status ?? 0, 10);

      if (newStatus !== session.payment_status) {
        await db.query(
          `UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, session.id]
        );
        if (newStatus === 2) {
          notifyShopQRPayment(session.shop_id, {
            reference:      session.reference,
            payment_status: newStatus,
            amount:         session.amount,
          });
        }
      }

      return res.json({ payment_status: newStatus, amount: session.amount, reference });
    } catch {
      // If HelaPOS call fails, return last known status from DB
      return res.json({ payment_status: session.payment_status, amount: session.amount, reference });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── GET /api/qr/display/:reference (public) ──────────────────
async function getDisplayStatus(req, res) {
  const { reference } = req.params;
  try {
    // We only store qr_data during generation; re-generate it here from DB is not possible.
    // Instead we store qr_data in the session on creation.
    const { rows } = await db.query(
      `SELECT qr_data, amount, payment_status, expires_at FROM qr_payment_sessions WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getConfig, saveConfig, generateQR, handleWebhook, checkStatus, getDisplayStatus };
