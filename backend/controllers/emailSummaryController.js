const db = require('../config/database');

const fmt = (n) => Number(n || 0).toFixed(2);

// ── GET /api/email-summary/daily ─────────────────────────────
// Called by the Google Apps Script cron at 10 PM.
// Protected by DAILY_SUMMARY_KEY environment variable.
async function getDailySummary(req, res) {
  const authHeader = req.headers.authorization || '';
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!process.env.DAILY_SUMMARY_KEY || key !== process.env.DAILY_SUMMARY_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // All shops that have an email address
    const { rows: shops } = await db.query(
      `SELECT id, name, email, phone, address
         FROM shops
        WHERE email IS NOT NULL AND email <> ''
        ORDER BY id ASC`
    );

    const summaries = await Promise.all(shops.map(async (shop) => {
      // Today's transaction summary
      const { rows: [stats] } = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed')                          AS transaction_count,
           COUNT(*) FILTER (WHERE status = 'voided')                             AS voided_count,
           COUNT(*) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL) AS refunded_count,
           COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'), 0) AS total_sales,
           COALESCE(SUM(tax_amount)      FILTER (WHERE status = 'completed'), 0) AS total_tax,
           COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0) AS total_discounts,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'
                                              AND payment_method = 'cash'),   0) AS cash_sales,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'
                                              AND payment_method = 'card'),   0) AS card_sales,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'
                                              AND payment_method = 'mobile'), 0) AS mobile_sales,
           COALESCE(ABS(SUM(total_amount) FILTER (WHERE status = 'refunded'
                                                   AND refund_of IS NOT NULL)), 0) AS total_refunds
         FROM transactions
        WHERE shop_id = $1
          AND DATE(transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE`,
        [shop.id]
      );

      const txCount       = parseInt(stats.transaction_count, 10) || 0;
      const net_sales     = parseFloat(stats.total_sales) - parseFloat(stats.total_refunds);
      const avg_transaction = txCount > 0 ? net_sales / txCount : 0;

      // Total items sold today
      const { rows: [itemStats] } = await db.query(
        `SELECT COALESCE(SUM(ti.quantity), 0) AS total_items_sold
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE`,
        [shop.id]
      );

      // Top 10 products sold today (by revenue)
      const { rows: top_products } = await db.query(
        `SELECT p.name,
                SUM(ti.quantity)  AS qty_sold,
                SUM(ti.subtotal)  AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           JOIN products      p ON p.id = ti.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE
          GROUP BY p.name
          ORDER BY revenue DESC
          LIMIT 10`,
        [shop.id]
      );

      return {
        shop_id:           shop.id,
        shop_name:         shop.name,
        email:             shop.email,
        phone:             shop.phone  || '',
        address:           shop.address || '',
        transaction_count: txCount,
        voided_count:      parseInt(stats.voided_count, 10) || 0,
        refunded_count:    parseInt(stats.refunded_count, 10) || 0,
        total_items_sold:  Math.round(parseFloat(itemStats.total_items_sold) || 0),
        total_sales:       fmt(stats.total_sales),
        net_sales:         fmt(net_sales),
        avg_transaction:   fmt(avg_transaction),
        total_tax:         fmt(stats.total_tax),
        total_discounts:   fmt(stats.total_discounts),
        total_refunds:     fmt(stats.total_refunds),
        cash_sales:        fmt(stats.cash_sales),
        card_sales:        fmt(stats.card_sales),
        mobile_sales:      fmt(stats.mobile_sales),
        top_products:      top_products.map((p) => ({
          name:     p.name,
          qty_sold: parseFloat(p.qty_sold),
          revenue:  fmt(p.revenue),
        })),
      };
    }));

    res.json({
      generated_at: new Date().toISOString(),
      shop_count:   summaries.length,
      shops:        summaries,
    });
  } catch (err) {
    console.error('emailSummary/daily error:', err);
    res.status(500).json({ error: 'Server error generating summary' });
  }
}

module.exports = { getDailySummary };
