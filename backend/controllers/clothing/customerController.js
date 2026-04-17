const db = require('../../config/database');

// ── GET /api/clothing/customers/lookup?phone=… ────────────────
async function lookupCustomer(req, res) {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const { rows } = await db.query(
      `SELECT c.*,
              (SELECT json_agg(t ORDER BY t.transaction_date DESC)
                 FROM (
                   SELECT id, transaction_number, total_amount,
                          loyalty_points_earned, transaction_date
                     FROM transactions
                    WHERE customer_phone = c.phone AND shop_id = $1
                    ORDER BY transaction_date DESC LIMIT 10
                 ) t
              ) AS recent_transactions
         FROM customers c
        WHERE c.shop_id = $1 AND c.phone = $2`,
      [req.shopId, phone.trim()]
    );

    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('lookupCustomer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/customers ──────────────────────────────
async function upsertCustomer(req, res) {
  const { phone, name = '', email = '' } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO customers (shop_id, phone, name, email)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (shop_id, phone)
       DO UPDATE SET
         name  = CASE WHEN $3 <> '' THEN $3 ELSE customers.name END,
         email = CASE WHEN $4 <> '' THEN $4 ELSE customers.email END
       RETURNING *`,
      [req.shopId, phone.trim(), name, email]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('upsertCustomer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/customers/:id/points ───────────────────
async function adjustLoyaltyPoints(req, res) {
  const { delta, reason = 'adjustment' } = req.body;
  const d = parseInt(delta, 10);
  if (!d) return res.status(400).json({ error: 'delta must be non-zero' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE customers SET loyalty_points = loyalty_points + $1
        WHERE id = $2 AND shop_id = $3 RETURNING *`,
      [d, req.params.id, req.shopId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (rows[0].loyalty_points < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient loyalty points' });
    }
    await client.query(
      `INSERT INTO loyalty_transactions (shop_id, customer_id, points_change, reason)
       VALUES ($1,$2,$3,$4)`,
      [req.shopId, req.params.id, d, reason]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adjustLoyaltyPoints error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
}

module.exports = { lookupCustomer, upsertCustomer, adjustLoyaltyPoints };
