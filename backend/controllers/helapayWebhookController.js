/**
 * HelaPlay Webhook Controller
 *
 * Handles POST /api/webhooks/helapay
 *
 * HelaPlay sends a signed JSON payload when a payment completes.
 * Signature: HMAC-SHA256 of raw request body, hex-encoded.
 * Header:    X-Helapay-Signature: sha256=<hex>   (also checks X-Signature)
 *
 * Payload formats supported:
 *   Format A (HelaPOS-style):
 *     { statusCode, reference, sale: { payment_status, amount, transaction_id, ... } }
 *   Format B (HelaPlay direct):
 *     { transaction_id, reference, amount, status, timestamp, payment_method, ... }
 */

const crypto = require('crypto');
const db     = require('../config/database');
const { fulfillBillingPayment } = require('./shopPaymentController');
const { fulfillAgentDeposit }   = require('./agentController');
const { notifyShopQRPayment, notifyAgent } = require('../websocket');

const WEBHOOK_SECRET = process.env.HELAPAY_WEBHOOK_SECRET || '';

// ── Helpers ───────────────────────────────────────────────────

function verifySignature(rawBody, headers) {
  if (!WEBHOOK_SECRET) {
    // Secret not configured — warn in dev, reject in production
    if (process.env.NODE_ENV === 'production') return false;
    console.warn('[HelaPayWH] HELAPAY_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
    return true;
  }

  const sigHeader =
    headers['x-helapay-signature'] ||
    headers['x-signature'] ||
    headers['x-helaPay-signature'] ||
    '';

  if (!sigHeader) return false;

  // Strip optional "sha256=" prefix
  const receivedHex = sigHeader.startsWith('sha256=')
    ? sigHeader.slice(7)
    : sigHeader;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedHex, 'hex'),
      Buffer.from(expected,    'hex')
    );
  } catch {
    return false;
  }
}

/** Normalise both payload formats into a single shape */
function normalisePayload(body) {
  // Format A: HelaPOS-style { statusCode, reference, sale: { ... } }
  if (body.sale !== undefined) {
    const sale = body.sale || {};
    return {
      reference:      body.reference || body.qr_reference,
      transaction_id: String(sale.transaction_id || sale.id || ''),
      amount:         Number(sale.amount || 0),
      // HelaPOS payment_status: 2 = paid, -1 = failed/cancelled
      status:         sale.payment_status === 2 ? 'success'
                    : sale.payment_status === -1 ? 'failed'
                    : 'pending',
      raw_status:     sale.payment_status,
      timestamp:      body.timestamp || new Date().toISOString(),
      payment_method: sale.payment_method || 'qr',
    };
  }

  // Format B: HelaPlay direct { transaction_id, reference, amount, status, ... }
  const status = String(body.status || '').toLowerCase();
  return {
    reference:      body.reference || body.qr_reference || body.order_reference,
    transaction_id: String(body.transaction_id || body.txn_id || ''),
    amount:         Number(body.amount || 0),
    status:         ['success','paid','completed','approved'].includes(status) ? 'success'
                  : ['failed','cancelled','rejected'].includes(status)         ? 'failed'
                  : 'pending',
    raw_status:     body.status,
    timestamp:      body.timestamp || body.paid_at || new Date().toISOString(),
    payment_method: body.payment_method || 'helapay',
  };
}

async function logWebhook(data) {
  try {
    await db.query(
      `INSERT INTO webhook_logs
         (source, reference, transaction_id, payload, headers, status, session_type, resolved_id, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        data.source        || 'helapay',
        data.reference     || null,
        data.transaction_id|| null,
        JSON.stringify(data.payload  || {}),
        JSON.stringify(data.headers  || {}),
        data.status        || 'received',
        data.session_type  || null,
        data.resolved_id   || null,
        data.error_message || null,
      ]
    );
  } catch (e) {
    console.error('[HelaPayWH] logWebhook error:', e.message);
  }
}

// ── Commission helpers ────────────────────────────────────────

async function createMonthlyCommission(client, agentId, shopId) {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  await client.query(
    `INSERT INTO agent_commissions
       (agent_id, shop_id, commission_type, amount, month, status, earned_date, payment_method)
     VALUES ($1, $2, 'monthly', 500, $3::DATE, 'approved', CURRENT_DATE, 'helapay')
     ON CONFLICT (agent_id, shop_id, commission_type, month) WHERE month IS NOT NULL DO NOTHING`,
    [agentId, shopId, currentMonth]
  );
}

async function createOnboardingCommission(client, agentId, shopId) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM agent_commissions
      WHERE agent_id = $1 AND shop_id = $2 AND commission_type = 'onboarding'`,
    [agentId, shopId]
  );
  if (rowCount === 0) {
    await client.query(
      `INSERT INTO agent_commissions
         (agent_id, shop_id, commission_type, amount, status, earned_date, payment_method)
       VALUES ($1, $2, 'onboarding', 500, 'approved', CURRENT_DATE, 'helapay')`,
      [agentId, shopId]
    );
  } else {
    // Commission already exists — just unlock it if still pending
    await client.query(
      `UPDATE agent_commissions
          SET status = 'approved', approved_at = NOW()
        WHERE agent_id = $1 AND shop_id = $2 AND commission_type = 'onboarding'
          AND status IN ('pending','locked')`,
      [agentId, shopId]
    );
  }
}

// ── Shop payment fulfillment ──────────────────────────────────
// Handles shops that paid directly (not via QR session proxy).
async function fulfillShopPaymentDirect(shopId, amount, transactionId, reference) {
  const { createNotification } = require('./notificationController');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: shopRows } = await client.query(
      `SELECT s.name, s.activation_status, s.onboarded_by_agent_id,
              s.subscription_status, s.subscription_end_date
         FROM shops s WHERE s.id = $1 FOR UPDATE`,
      [shopId]
    );
    if (!shopRows.length) {
      await client.query('ROLLBACK');
      return { skipped: true, reason: 'shop_not_found' };
    }
    const shop    = shopRows[0];
    const agentId = shop.onboarded_by_agent_id;

    const isFirstPayment = shop.activation_status !== 'active';
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Activate shop + update subscription dates
    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              last_payment_date   = CURRENT_DATE,
              subscription_end_date = $1::DATE
        WHERE id = $2`,
      [nextMonth.toISOString().slice(0, 10), shopId]
    );

    // Record in payments table
    await client.query(
      `INSERT INTO payments
         (shop_id, amount, payment_method, transaction_id, helapay_reference, status, created_at)
       VALUES ($1, $2, 'helapay', $3, $4, 'verified', NOW())
       ON CONFLICT DO NOTHING`,
      [shopId, amount, transactionId || null, reference || null]
    );

    // Commissions
    if (agentId) {
      if (isFirstPayment) {
        await createOnboardingCommission(client, agentId, shopId);
      } else {
        await createMonthlyCommission(client, agentId, shopId);
      }
    }

    await client.query('COMMIT');

    // Notifications (non-blocking)
    try {
      await createNotification(
        shopId,
        'payment_verified',
        'Payment Confirmed — Account Active',
        `HelaPlay payment of LKR ${amount.toFixed(2)} confirmed. Your account is active.`,
        { method: 'helapay', amount, transaction_id: transactionId }
      );
    } catch {}

    if (agentId) {
      notifyAgent(agentId, {
        event:     'shop_activated',
        shop_id:   shopId,
        shop_name: shop.name,
        method:    'helapay',
      });
    }

    return {
      skipped:          false,
      is_first_payment: isFirstPayment,
      shop_name:        shop.name,
      agent_id:         agentId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Agent deposit fulfillment (direct path, no QR session) ───
async function fulfillAgentPaymentDirect(agentId, amount, transactionId, reference) {
  // Agent payments: 2500 LKR paid → 500 LKR credited to balance
  const CREDIT_AMOUNT = 500;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, name FROM sales_agents WHERE id = $1 FOR UPDATE`,
      [agentId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return { skipped: true, reason: 'agent_not_found' };
    }

    // Upsert agent_self_payments; skip if reference already logged
    const { rowCount: inserted } = await client.query(
      `INSERT INTO agent_self_payments
         (agent_id, amount_paid, credited, reference, status, paid_at)
       VALUES ($1, $2, $3, $4, 'completed', NOW())
       ON CONFLICT (reference) DO NOTHING`,
      [agentId, amount, CREDIT_AMOUNT, reference || transactionId || `direct_${Date.now()}`]
    );

    if (inserted === 0) {
      await client.query('ROLLBACK');
      return { skipped: true, reason: 'duplicate_reference' };
    }

    // Credit agent_wallet
    await client.query(
      `INSERT INTO agent_wallet (agent_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (agent_id) DO UPDATE SET balance = agent_wallet.balance + $2`,
      [agentId, CREDIT_AMOUNT]
    );

    // Sync denormalised balance on sales_agents
    await client.query(
      `UPDATE sales_agents sa
          SET account_balance = COALESCE((SELECT balance FROM agent_wallet WHERE agent_id = sa.id), 0)
        WHERE id = $1`,
      [agentId]
    );

    await client.query('COMMIT');
    return { skipped: false, credited: CREDIT_AMOUNT, agent_name: rows[0].name };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Main webhook handler ──────────────────────────────────────

async function handleHelaPay(req, res) {
  // Always respond 200 fast — HelaPlay retries on non-2xx
  res.json({ received: true });

  const rawBody   = req.rawBody || JSON.stringify(req.body || {});
  const body      = req.body    || {};
  const headers   = req.headers || {};

  // ── 1. Signature verification ─────────────────────────────
  if (!verifySignature(rawBody, headers)) {
    console.warn('[HelaPayWH] Signature verification failed');
    await logWebhook({
      source:         'helapay',
      payload:         body,
      headers:         { 'x-helapay-signature': headers['x-helapay-signature'] },
      status:         'failed',
      error_message:  'invalid_signature',
    });
    return;
  }

  // ── 2. Normalise payload ──────────────────────────────────
  const parsed = normalisePayload(body);
  const { reference, transaction_id, amount, status } = parsed;

  console.log('[HelaPayWH] received:', JSON.stringify({ reference, transaction_id, status, amount }));

  if (!reference && !transaction_id) {
    console.warn('[HelaPayWH] Missing reference and transaction_id');
    await logWebhook({
      source: 'helapay', payload: body, headers,
      status: 'failed', error_message: 'missing_reference',
    });
    return;
  }

  // Only process successful payments
  if (status !== 'success') {
    console.log('[HelaPayWH] Non-success status — logging only:', status);
    await logWebhook({
      source: 'helapay', reference, transaction_id,
      payload: body, headers, status: 'received',
    });
    return;
  }

  // ── 3. Look up QR session by reference ───────────────────
  let session = null;
  if (reference) {
    const { rows } = await db.query(
      `SELECT id, shop_id, agent_id, reference, qr_reference,
              payment_status, session_type, billing_proof_id
         FROM qr_payment_sessions
        WHERE (reference = $1 OR qr_reference = $1)
          AND payment_status = 0
        LIMIT 1`,
      [reference]
    );
    session = rows[0] || null;
  }

  // ── 4. Route based on session type ───────────────────────
  try {
    if (session) {
      // Mark session settled
      await db.query(
        `UPDATE qr_payment_sessions
            SET payment_status = 2, updated_at = NOW()
          WHERE id = $1 AND payment_status = 0`,
        [session.id]
      );

      if (session.session_type === 'agent_deposit' && session.agent_id) {
        // Agent paid 2500 via QR — credit 500 to balance
        await fulfillAgentDeposit(session.id, session.agent_id, session.reference);
        await logWebhook({
          source: 'helapay', reference, transaction_id,
          payload: body, headers, status: 'processed',
          session_type: 'agent_deposit', resolved_id: session.id,
        });
        return;
      }

      if (session.session_type === 'billing' && session.billing_proof_id) {
        // Shop activation QR — fulfil billing proof
        await fulfillBillingPayment(session.billing_proof_id, session.shop_id, session.qr_reference);
        notifyShopQRPayment(session.shop_id, {
          reference:      session.reference,
          payment_status: 2,
          session_type:   'billing',
        });
        await logWebhook({
          source: 'helapay', reference, transaction_id,
          payload: body, headers, status: 'processed',
          session_type: 'billing', resolved_id: session.id,
        });
        return;
      }

      // POS / other session
      notifyShopQRPayment(session.shop_id, {
        reference:      session.reference,
        payment_status: 2,
      });
      await logWebhook({
        source: 'helapay', reference, transaction_id,
        payload: body, headers, status: 'processed',
        session_type: session.session_type, resolved_id: session.id,
      });
      return;
    }

    // ── 5. No QR session — try matching shop_payment_proofs ─
    if (reference) {
      const { rows: proofRows } = await db.query(
        `SELECT id, shop_id, agent_id, status
           FROM shop_payment_proofs
          WHERE qr_reference = $1 OR proof_url LIKE '%' || $1 || '%'
          LIMIT 1`,
        [reference]
      );
      if (proofRows.length && proofRows[0].status === 'pending') {
        await fulfillBillingPayment(proofRows[0].id, proofRows[0].shop_id, reference);
        await logWebhook({
          source: 'helapay', reference, transaction_id,
          payload: body, headers, status: 'processed',
          session_type: 'billing', resolved_id: proofRows[0].id,
        });
        return;
      }
    }

    // ── 6. Try matching by shop reference ID (LKR 2500 direct pay) ─
    // HelaPlay may include our shop_reference_id in the reference field
    if (reference && /^SHP-/i.test(reference)) {
      const { rows: shopRows } = await db.query(
        `SELECT id FROM shops WHERE UPPER(shop_reference_id) = UPPER($1)`,
        [reference]
      );
      if (shopRows.length) {
        const result = await fulfillShopPaymentDirect(shopRows[0].id, amount, transaction_id, reference);
        await logWebhook({
          source: 'helapay', reference, transaction_id,
          payload: body, headers,
          status: result.skipped ? 'duplicate' : 'processed',
          session_type: 'billing',
        });
        return;
      }
    }

    // ── 7. Try matching as agent deposit by agent reference ──
    // Agent's own deposit — reference may start with "AGT-"
    if (reference && /^AGT-/i.test(reference)) {
      const agentRef = reference.replace(/^AGT-/i, '');
      const { rows: agentRows } = await db.query(
        `SELECT id FROM sales_agents WHERE id::TEXT = $1 OR email = $1`,
        [agentRef]
      );
      if (agentRows.length && amount >= 2500) {
        const result = await fulfillAgentPaymentDirect(agentRows[0].id, amount, transaction_id, reference);
        await logWebhook({
          source: 'helapay', reference, transaction_id,
          payload: body, headers,
          status: result.skipped ? 'duplicate' : 'processed',
          session_type: 'agent_deposit',
        });
        return;
      }
    }

    // ── 8. Unmatched ─────────────────────────────────────────
    console.warn('[HelaPayWH] No matching session or shop for reference:', reference);
    await logWebhook({
      source: 'helapay', reference, transaction_id,
      payload: body, headers, status: 'failed',
      error_message: 'no_match_found',
    });

  } catch (err) {
    console.error('[HelaPayWH] Processing error:', err.message);
    await logWebhook({
      source: 'helapay', reference, transaction_id,
      payload: body, headers, status: 'failed',
      error_message: err.message,
    });
  }
}

// GET /api/webhooks/logs  (admin only — debugging)
async function getWebhookLogs(req, res) {
  const { status, source, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params     = [];

  if (status) { params.push(status);  conditions.push(`status = $${params.length}`); }
  if (source) { params.push(source);  conditions.push(`source = $${params.length}`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(Math.min(Number(limit), 500));
  params.push(Number(offset));

  try {
    const { rows } = await db.query(
      `SELECT id, source, reference, transaction_id, status, session_type,
              resolved_id, error_message, created_at
         FROM webhook_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[HelaPayWH] getWebhookLogs error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { handleHelaPay, getWebhookLogs };
