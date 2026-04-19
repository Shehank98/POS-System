const { randomUUID } = require('crypto');
const db             = require('../config/database');
const helapos        = require('../services/helaposService');
const { notifyShopQRPayment } = require('../websocket');
const { sendToTopic } = require('../utils/fcm');

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
    await helapos.getOrRefreshToken(req.shopId);
    const { qr_data, qr_reference } = await helapos.generateQR(req.shopId, business_id, reference, Number(amount));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO qr_payment_sessions
         (shop_id, reference, qr_reference, amount, session_type, pre_order_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.shopId, reference, qr_reference, Number(amount), session_type, pre_order_id || null, expiresAt]
    );
    res.json({ reference, qr_data, qr_reference, expires_at: expiresAt });
  } catch (err) {
    console.error('[QR] generateQR error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate QR' });
  }
}

// POST /api/qr/webhook  (public — called by HelaPOS)
async function handleWebhook(req, res) {
  try {
    const body         = req.body || {};
    const qrRef        = body.qr_reference || body.qrReference || (body.sale && body.sale.qr_reference);
    const payStatus    = body.payment_status ?? (body.sale && body.sale.payment_status) ?? 2;

    if (!qrRef) return res.status(400).json({ error: 'qr_reference missing' });

    const { rows } = await db.query(
      'SELECT id, shop_id, reference FROM qr_payment_sessions WHERE qr_reference = $1',
      [qrRef]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });

    const session = rows[0];
    await db.query(
      'UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2',
      [payStatus, session.id]
    );

    notifyShopQRPayment(session.shop_id, {
      reference:      session.reference,
      payment_status: payStatus,
    });

    // Push notification to mobile app when payment succeeds
    if (payStatus === 2) {
      sendToTopic(
        `shop_${session.shop_id}_alerts`,
        'QR Payment Received',
        `Payment confirmed for reference ${session.reference.slice(0, 8).toUpperCase()}`,
        { type: 'qr_payment', reference: session.reference, payment_status: '2' }
      ).catch(() => {});
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[QR] handleWebhook error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/qr/status/:reference  (authenticated staff)
async function checkStatus(req, res) {
  const { reference } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM qr_payment_sessions WHERE reference = $1 AND shop_id = $2',
      [reference, req.shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = rows[0];

    if (session.payment_status !== 0) {
      return res.json({
        payment_status: session.payment_status,
        amount:         session.amount,
        expires_at:     session.expires_at,
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.json({ payment_status: -2, amount: session.amount, expires_at: session.expires_at });
    }

    try {
      const { payment_status } = await helapos.checkPaymentStatus(
        req.shopId, reference, session.qr_reference
      );
      if (payment_status !== 0) {
        await db.query(
          'UPDATE qr_payment_sessions SET payment_status = $1, updated_at = NOW() WHERE id = $2',
          [payment_status, session.id]
        );
        if (payment_status === 2) {
          notifyShopQRPayment(req.shopId, { reference, payment_status });
        }
      }
      return res.json({ payment_status, amount: session.amount, expires_at: session.expires_at });
    } catch {
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

module.exports = { getConfig, saveConfig, generateQR, handleWebhook, checkStatus, getDisplayStatus };
