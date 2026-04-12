const db = require('../config/database');

const MAX_PROOF_SIZE = 2 * 1024 * 1024; // 2 MB base64 limit

// ── GET /api/payments/bank-info (public) ──────────────────────
function getBankInfo(_req, res) {
  res.json({
    bank_name:       process.env.BANK_NAME           || '',
    account_number:  process.env.BANK_ACCOUNT_NUMBER || '',
    account_name:    process.env.BANK_ACCOUNT_NAME   || '',
    qr_url:          process.env.BANK_QR_URL         || '',
    instructions:    process.env.BANK_INSTRUCTIONS   || 'Transfer the exact amount and upload your payment screenshot.',
  });
}

// ── POST /api/payments ────────────────────────────────────────
async function submitPayment(req, res) {
  const { amount, subscription_months = 1, payment_proof } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'A valid amount is required' });
  }
  const months = parseInt(subscription_months, 10);
  if (!months || months < 1 || months > 24) {
    return res.status(400).json({ error: 'subscription_months must be between 1 and 24' });
  }
  if (payment_proof && payment_proof.length > MAX_PROOF_SIZE) {
    return res.status(400).json({ error: 'Payment proof image is too large (max 2 MB)' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO payments (shop_id, amount, subscription_months, payment_proof, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, shop_id, amount, payment_date, status, subscription_months`,
      [req.shopId, Number(amount), months, payment_proof || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('submitPayment error:', err);
    res.status(500).json({ error: 'Server error submitting payment' });
  }
}

// ── GET /api/payments ─────────────────────────────────────────
async function getMyPayments(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, amount, payment_date, status, subscription_months, notes
       FROM payments
       WHERE shop_id = $1
       ORDER BY payment_date DESC`,
      [req.shopId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getMyPayments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getBankInfo, submitPayment, getMyPayments };
