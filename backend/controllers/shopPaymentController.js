const db = require('../config/database');
const { uploadFile } = require('../utils/storageService');

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
             s.name AS shop_name, s.owner_name, s.shop_reference_id, s.activation_status,
             sa.name AS agent_name
        FROM shop_payment_proofs spp
        JOIN shops s ON s.id = spp.shop_id
        LEFT JOIN sales_agents sa ON sa.id = spp.agent_id
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

    // Activate the shop account
    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              subscription_end_date = GREATEST(
                COALESCE(subscription_end_date, NOW()),
                DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
              ) + INTERVAL '1 month'
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

    // Unlock signup commission for the agent who registered this shop
    if (proof.agent_id) {
      await client.query(
        `UPDATE agent_commissions
            SET status = 'approved'
          WHERE agent_id = $1 AND shop_id = $2
            AND commission_type = 'signup' AND status = 'locked'`,
        [proof.agent_id, proof.shop_id]
      );
    }

    await client.query('COMMIT');
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
        WHERE id = $1 AND payment_method = 'agent_helaPay' AND status = 'pending' FOR UPDATE`,
      [proofId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'HelaPay proof not found or already processed' });
    }
    const proof = rows[0];

    await client.query(
      `UPDATE shops
          SET activation_status   = 'active',
              subscription_status = 'active',
              subscription_end_date = GREATEST(
                COALESCE(subscription_end_date, NOW()),
                DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
              ) + INTERVAL '1 month'
        WHERE id = $1`,
      [proof.shop_id]
    );

    await client.query(
      `UPDATE shop_payment_proofs SET status = 'verified', reviewed_at = NOW() WHERE id = $1`,
      [proofId]
    );

    if (proof.agent_id) {
      await client.query(
        `UPDATE agent_commissions
            SET status = 'approved'
          WHERE agent_id = $1 AND shop_id = $2
            AND commission_type = 'signup' AND status = 'locked'`,
        [proof.agent_id, proof.shop_id]
      );
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

module.exports = {
  uploadPaymentProof,
  listMyProofs,
  adminListShopPayments,
  adminVerifyShopPayment,
  adminRejectShopPayment,
  adminVerifyHelaPay,
};
