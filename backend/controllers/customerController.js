const db = require('../config/database');

// ── Helper: format weight for display ────────────────────────
function formatWeight(kg) {
  const grams = parseFloat(kg) * 1000;
  if (grams < 1000) return `${Math.round(grams)}g`;
  return `${parseFloat(parseFloat(kg).toFixed(3))}kg`;
}

// ── GET /api/customers/insights?phone=X ───────────────────────
// Full customer profile: orders, spend, top items, cancellations
async function getCustomerInsights(req, res) {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const trimPhone = phone.trim();

  try {
    // Base stats
    const { rows: statsRows } = await db.query(
      `SELECT
         COUNT(*)                                                  AS total_orders,
         COUNT(*) FILTER (WHERE status = 'CANCELLED')             AS total_cancelled,
         COUNT(*) FILTER (WHERE status = 'COMPLETED')             AS total_completed,
         COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('CANCELLED')), 0) AS total_spent,
         MAX(created_at)                                           AS last_order_date,
         MIN(created_at)                                           AS first_order_date
       FROM pre_orders
       WHERE shop_id = $1 AND customer_phone = $2`,
      [req.shopId, trimPhone]
    );

    if (statsRows.length === 0 || parseInt(statsRows[0].total_orders, 10) === 0) {
      return res.status(404).json({ error: 'No orders found for this phone number' });
    }

    // Frequently ordered items — unnest JSONB array
    const { rows: itemRows } = await db.query(
      `SELECT
         item->>'name'                               AS item_name,
         SUM((item->>'quantity')::numeric)           AS total_qty,
         COUNT(*)                                    AS order_count
       FROM pre_orders,
            jsonb_array_elements(items) AS item
       WHERE shop_id = $1
         AND customer_phone = $2
         AND status NOT IN ('CANCELLED')
       GROUP BY item_name
       ORDER BY total_qty DESC
       LIMIT 8`,
      [req.shopId, trimPhone]
    );

    // Cancellation tracking record
    let cancellationRecord = null;
    try {
      const { rows: cRows } = await db.query(
        `SELECT * FROM customer_cancellation_tracking
          WHERE shop_id = $1 AND customer_phone = $2`,
        [req.shopId, trimPhone]
      );
      cancellationRecord = cRows[0] || null;
    } catch { /* table may not exist yet */ }

    // Recent orders (last 10)
    const { rows: recentOrders } = await db.query(
      `SELECT id, token_number, status, payment_status, total_amount, created_at
         FROM pre_orders
        WHERE shop_id = $1 AND customer_phone = $2
        ORDER BY created_at DESC
        LIMIT 10`,
      [req.shopId, trimPhone]
    );

    const stats = statsRows[0];
    res.json({
      phone:          trimPhone,
      total_orders:   parseInt(stats.total_orders, 10),
      total_completed: parseInt(stats.total_completed, 10),
      total_cancelled: parseInt(stats.total_cancelled, 10),
      total_spent:    parseFloat(stats.total_spent),
      last_order_date: stats.last_order_date,
      first_order_date: stats.first_order_date,
      top_items:      itemRows,
      recent_orders:  recentOrders.map((r) => ({ ...r, payment_status: r.payment_status || 'pending' })),
      cancellation_tracking: cancellationRecord,
    });
  } catch (err) {
    console.error('getCustomerInsights error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/customers/top ────────────────────────────────────
// Top customers by total spend (from completed pre-orders)
async function getTopCustomers(req, res) {
  const { limit = 20 } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT
         customer_phone                                              AS phone,
         MAX(customer_name)                                          AS name,
         COUNT(*)                                                    AS total_orders,
         COUNT(*) FILTER (WHERE status = 'COMPLETED')               AS completed_orders,
         COUNT(*) FILTER (WHERE status = 'CANCELLED')               AS cancelled_orders,
         COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('CANCELLED')), 0) AS total_spent,
         MAX(created_at)                                             AS last_order_date
       FROM pre_orders
       WHERE shop_id = $1
       GROUP BY customer_phone
       ORDER BY total_spent DESC
       LIMIT $2`,
      [req.shopId, parseInt(limit, 10)]
    );
    res.json({ customers: rows });
  } catch (err) {
    console.error('getTopCustomers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getCustomerInsights, getTopCustomers };
