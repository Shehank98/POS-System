const db = require('../config/database');

// ── GET /api/dashboard/today ──────────────────────────────────
async function getToday(req, res) {
  try {
    const [summaryRes, topProductsRes, hourlyRes] = await Promise.all([
      // Summary totals for today
      db.query(
        `SELECT
           COUNT(*)      FILTER (WHERE status = 'completed')                         AS transaction_count,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'), 0)     AS total_sales,
           COALESCE(SUM(tax_amount)      FILTER (WHERE status = 'completed'), 0)     AS total_tax,
           COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0)     AS total_discounts,
           COALESCE(ABS(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL)), 0) AS total_refunds,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0)
             + COALESCE(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL), 0) AS net_sales,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'
                                                  AND payment_method = 'cash'), 0)  AS cash_sales,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'
                                                  AND payment_method = 'card'), 0)  AS card_sales,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'
                                                  AND payment_method = 'mobile'), 0) AS mobile_sales
         FROM transactions
        WHERE shop_id = $1
          AND DATE(transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE`,
        [req.shopId]
      ),

      // Top 5 products sold today
      db.query(
        `SELECT p.name,
                p.id   AS product_id,
                SUM(ti.quantity)  AS qty_sold,
                SUM(ti.subtotal)  AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           JOIN products      p ON p.id = ti.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE
          GROUP BY p.id, p.name
          ORDER BY qty_sold DESC
          LIMIT 5`,
        [req.shopId]
      ),

      // Hourly breakdown for today (for mini chart)
      db.query(
        `SELECT EXTRACT(HOUR FROM transaction_date AT TIME ZONE 'UTC') AS hour,
                COALESCE(SUM(total_amount), 0)  AS sales,
                COUNT(*) AS count
           FROM transactions
          WHERE shop_id = $1
            AND status  = 'completed'
            AND DATE(transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE
          GROUP BY hour
          ORDER BY hour`,
        [req.shopId]
      ),
    ]);

    // Items sold today
    const itemsRes = await db.query(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS items_sold
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.shop_id = $1
          AND t.status  = 'completed'
          AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE`,
      [req.shopId]
    );

    res.json({
      summary:      summaryRes.rows[0],
      items_sold:   parseFloat(itemsRes.rows[0].items_sold) || 0,
      top_products: topProductsRes.rows,
      hourly:       hourlyRes.rows,
    });
  } catch (err) {
    console.error('dashboard/today error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/dashboard/yesterday ─────────────────────────────
async function getYesterday(req, res) {
  try {
    const [summaryRes, topProductsRes] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)      FILTER (WHERE status = 'completed')                         AS transaction_count,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'), 0)     AS total_sales,
           COALESCE(SUM(tax_amount)      FILTER (WHERE status = 'completed'), 0)     AS total_tax,
           COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0)     AS total_discounts,
           COALESCE(ABS(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL)), 0) AS total_refunds,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0)
             + COALESCE(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL), 0) AS net_sales,
           COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='cash'),   0) AS cash_sales,
           COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='card'),   0) AS card_sales,
           COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='mobile'), 0) AS mobile_sales
         FROM transactions
        WHERE shop_id = $1
          AND DATE(transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE - 1`,
        [req.shopId]
      ),
      db.query(
        `SELECT p.name, p.id AS product_id, SUM(ti.quantity) AS qty_sold, SUM(ti.subtotal) AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           JOIN products      p ON p.id = ti.product_id
          WHERE t.shop_id = $1 AND t.status = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE - 1
          GROUP BY p.id, p.name ORDER BY qty_sold DESC LIMIT 5`,
        [req.shopId]
      ),
    ]);

    const itemsRes = await db.query(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS items_sold
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.shop_id = $1 AND t.status = 'completed'
          AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE - 1`,
      [req.shopId]
    );

    res.json({
      summary:      summaryRes.rows[0],
      items_sold:   parseFloat(itemsRes.rows[0].items_sold) || 0,
      top_products: topProductsRes.rows,
    });
  } catch (err) {
    console.error('dashboard/yesterday error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/dashboard/week ───────────────────────────────────
async function getWeek(req, res) {
  try {
    const [dailyRes, topProductsRes] = await Promise.all([
      // Daily totals for last 7 days
      db.query(
        `SELECT DATE(transaction_date AT TIME ZONE 'UTC') AS day,
                COALESCE(SUM(total_amount), 0) AS sales,
                COUNT(*) AS transactions
           FROM transactions
          WHERE shop_id = $1
            AND status  = 'completed'
            AND transaction_date >= NOW() - INTERVAL '6 days'
          GROUP BY day
          ORDER BY day ASC`,
        [req.shopId]
      ),

      // Top 5 products this week
      db.query(
        `SELECT p.name,
                SUM(ti.quantity) AS qty_sold,
                SUM(ti.subtotal) AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           JOIN products      p ON p.id = ti.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND t.transaction_date >= NOW() - INTERVAL '6 days'
          GROUP BY p.id, p.name
          ORDER BY qty_sold DESC
          LIMIT 5`,
        [req.shopId]
      ),
    ]);

    // Fill missing days with zeros so the chart always has 7 points
    const filled = fillDays(dailyRes.rows, 7);

    res.json({ daily: filled, top_products: topProductsRes.rows });
  } catch (err) {
    console.error('dashboard/week error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/dashboard/month ──────────────────────────────────
async function getMonth(req, res) {
  try {
    const [dailyRes, methodRes] = await Promise.all([
      db.query(
        `SELECT DATE(transaction_date AT TIME ZONE 'UTC') AS day,
                COALESCE(SUM(total_amount), 0) AS sales,
                COUNT(*) AS transactions
           FROM transactions
          WHERE shop_id = $1
            AND status  = 'completed'
            AND transaction_date >= DATE_TRUNC('month', NOW())
          GROUP BY day
          ORDER BY day ASC`,
        [req.shopId]
      ),

      // Payment method breakdown
      db.query(
        `SELECT payment_method,
                COUNT(*)           AS count,
                SUM(total_amount)  AS total
           FROM transactions
          WHERE shop_id = $1
            AND status  = 'completed'
            AND transaction_date >= DATE_TRUNC('month', NOW())
          GROUP BY payment_method`,
        [req.shopId]
      ),
    ]);

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const filled = fillDays(dailyRes.rows, daysInMonth, true);

    res.json({ daily: filled, payment_methods: methodRes.rows });
  } catch (err) {
    console.error('dashboard/month error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/dashboard/low-stock ─────────────────────────────
async function getLowStock(req, res) {
  const threshold = parseInt(req.query.threshold, 10) || 10;
  try {
    const { rows } = await db.query(
      `SELECT id, name, stock_quantity, category
         FROM products
        WHERE shop_id      = $1
          AND has_inventory = true
          AND stock_quantity < $2
        ORDER BY stock_quantity ASC
        LIMIT 50`,
      [req.shopId, threshold]
    );
    res.json({ threshold, products: rows });
  } catch (err) {
    console.error('dashboard/low-stock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Helper: fill in missing dates with 0 ─────────────────────
function fillDays(rows, count, fromMonthStart = false) {
  const map = {};
  rows.forEach((r) => { map[r.day.toISOString().split('T')[0]] = r; });

  const result = [];
  for (let i = fromMonthStart ? 0 : count - 1; i >= 0; i--) {
    const d = new Date();
    if (fromMonthStart) {
      d.setDate(i + 1);
    } else {
      d.setDate(d.getDate() - i);
    }
    const key = d.toISOString().split('T')[0];
    result.push(
      map[key] || { day: key, sales: '0', transactions: '0' }
    );
  }
  // If fromMonthStart, result is already in order
  return fromMonthStart ? result : result;
}

module.exports = { getToday, getYesterday, getWeek, getMonth, getLowStock };
