const db = require('../config/database');

// ── Helper: format weight for display ────────────────────────
function formatWeight(kg) {
  const grams = parseFloat(kg) * 1000;
  if (grams < 1000) return `${Math.round(grams)}g`;
  return `${parseFloat(parseFloat(kg).toFixed(3))}kg`;
}

// ── GET /api/customers/insights?phone=X ───────────────────────
// Full customer profile: covers both pre-orders and POS transactions
async function getCustomerInsights(req, res) {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const trimPhone = phone.trim();

  try {
    // Pre-order stats (also grab name as fallback when customers table has no record)
    const { rows: poStats } = await db.query(
      `SELECT
         COUNT(*)                                                  AS total_orders,
         COUNT(*) FILTER (WHERE status = 'CANCELLED')             AS total_cancelled,
         COUNT(*) FILTER (WHERE status = 'COMPLETED')             AS total_completed,
         COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('CANCELLED')), 0) AS total_spent,
         MAX(created_at)                                           AS last_order_date,
         MIN(created_at)                                           AS first_order_date,
         MAX(NULLIF(TRIM(customer_name), ''))                     AS pre_order_name
       FROM pre_orders
       WHERE shop_id = $1 AND customer_phone = $2`,
      [req.shopId, trimPhone]
    );

    // POS transaction stats (clothing / retail purchases at counter)
    let txnStats = { total_orders: 0, total_spent: 0, last_order_date: null };
    try {
      const { rows: txRows } = await db.query(
        `SELECT
           COUNT(*)                          AS total_orders,
           COALESCE(SUM(total_amount), 0)    AS total_spent,
           MAX(transaction_date)             AS last_order_date
         FROM transactions
         WHERE shop_id = $1 AND customer_phone = $2 AND status = 'completed'`,
        [req.shopId, trimPhone]
      );
      if (txRows.length) txnStats = txRows[0];
    } catch { /* customer_phone column may not exist pre-migration */ }

    // Loyalty points from customers table
    let loyaltyPoints = 0;
    let customerName  = '';
    try {
      const { rows: cRows } = await db.query(
        `SELECT name, loyalty_points FROM customers WHERE shop_id = $1 AND phone = $2`,
        [req.shopId, trimPhone]
      );
      if (cRows.length) { loyaltyPoints = cRows[0].loyalty_points; customerName = cRows[0].name || ''; }
    } catch { /* customers table may not exist pre-migration */ }

    // Fallback: use pre_orders customer_name when customers table has no name
    if (!customerName && poStats[0].pre_order_name) {
      customerName = poStats[0].pre_order_name;
    }

    const totalOrders = parseInt(poStats[0].total_orders, 10) + parseInt(txnStats.total_orders, 10);
    const totalSpent  = parseFloat(poStats[0].total_spent) + parseFloat(txnStats.total_spent);

    if (totalOrders === 0 && !loyaltyPoints) {
      return res.status(404).json({ error: 'No orders found for this phone number' });
    }

    const lastDate = [poStats[0].last_order_date, txnStats.last_order_date]
      .filter(Boolean)
      .sort()
      .pop() || null;

    // Frequently ordered items from pre-orders
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

    // Recent POS transactions
    let recentTxns = [];
    try {
      const { rows } = await db.query(
        `SELECT id, transaction_number AS token_number,
                'COMPLETED' AS status, total_amount, transaction_date AS created_at
           FROM transactions
          WHERE shop_id = $1 AND customer_phone = $2 AND status = 'completed'
          ORDER BY transaction_date DESC LIMIT 5`,
        [req.shopId, trimPhone]
      );
      recentTxns = rows;
    } catch { /* ignore */ }

    // Recent pre-orders
    const { rows: recentOrders } = await db.query(
      `SELECT id, token_number, status, payment_status, total_amount, created_at
         FROM pre_orders
        WHERE shop_id = $1 AND customer_phone = $2
        ORDER BY created_at DESC LIMIT 5`,
      [req.shopId, trimPhone]
    );

    // Cancellation tracking
    let cancellationRecord = null;
    try {
      const { rows: cRows } = await db.query(
        `SELECT * FROM customer_cancellation_tracking
          WHERE shop_id = $1 AND customer_phone = $2`,
        [req.shopId, trimPhone]
      );
      cancellationRecord = cRows[0] || null;
    } catch { /* table may not exist yet */ }

    res.json({
      customer_phone:  trimPhone,
      customer_name:   customerName,
      total_orders:    totalOrders,
      total_completed: parseInt(poStats[0].total_completed, 10),
      total_cancelled: parseInt(poStats[0].total_cancelled, 10),
      total_spent:     totalSpent,
      loyalty_points:  loyaltyPoints,
      last_order_date: lastDate,
      first_order_date: poStats[0].first_order_date,
      top_items:       itemRows,
      recent_orders:   [
        ...recentTxns,
        ...recentOrders.map((r) => ({ ...r, payment_status: r.payment_status || 'pending' })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10),
      cancellation_tracking: cancellationRecord,
    });
  } catch (err) {
    console.error('getCustomerInsights error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/customers/top ────────────────────────────────────
// Top customers by total spend (pre-orders + POS transactions combined)
async function getTopCustomers(req, res) {
  const { limit = 20 } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT
         customer_phone,
         MAX(customer_name)   AS name,
         SUM(total_orders)    AS total_orders,
         SUM(total_spent)     AS total_spent,
         MAX(last_order_date) AS last_order_date
       FROM (
         -- Pre-orders
         SELECT customer_phone,
                MAX(customer_name)                                                    AS customer_name,
                COUNT(*)                                                              AS total_orders,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('CANCELLED')), 0) AS total_spent,
                MAX(created_at)                                                       AS last_order_date
           FROM pre_orders
          WHERE shop_id = $1 AND customer_phone IS NOT NULL
          GROUP BY customer_phone
         UNION ALL
         -- POS transactions
         SELECT customer_phone,
                NULL                                AS customer_name,
                COUNT(*)                            AS total_orders,
                COALESCE(SUM(total_amount), 0)      AS total_spent,
                MAX(transaction_date)               AS last_order_date
           FROM transactions
          WHERE shop_id = $1 AND customer_phone IS NOT NULL AND status = 'completed'
          GROUP BY customer_phone
       ) combined
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
