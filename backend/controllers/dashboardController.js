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

      // Top 5 products sold today (includes clothing variants)
      db.query(
        `SELECT COALESCE(cp.name, p.name)   AS name,
                SUM(ti.quantity)             AS qty_sold,
                SUM(ti.subtotal)             AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           LEFT JOIN products         p  ON p.id  = ti.product_id
           LEFT JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
           LEFT JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE
          GROUP BY COALESCE(cp.name, p.name)
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

    // Items sold today — kg products count as 1 per line (not by weight)
    const itemsRes = await db.query(
      `SELECT COALESCE(SUM(
          CASE WHEN COALESCE(p.unit_type, 'unit') = 'kg' THEN 1 ELSE ti.quantity END
        ), 0) AS items_sold
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
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
        `SELECT COALESCE(cp.name, p.name) AS name,
                SUM(ti.quantity) AS qty_sold, SUM(ti.subtotal) AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           LEFT JOIN products p ON p.id = ti.product_id
           LEFT JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
           LEFT JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE t.shop_id = $1 AND t.status = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') = CURRENT_DATE - 1
          GROUP BY COALESCE(cp.name, p.name) ORDER BY qty_sold DESC LIMIT 5`,
        [req.shopId]
      ),
    ]);

    const itemsRes = await db.query(
      `SELECT COALESCE(SUM(
          CASE WHEN COALESCE(p.unit_type, 'unit') = 'kg' THEN 1 ELSE ti.quantity END
        ), 0) AS items_sold
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
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
      // Daily totals for last 7 days — filter by UTC date to match grouping
      db.query(
        `SELECT DATE(transaction_date AT TIME ZONE 'UTC') AS day,
                COALESCE(SUM(total_amount), 0) AS sales,
                COUNT(*) AS transactions
           FROM transactions
          WHERE shop_id = $1
            AND status  = 'completed'
            AND DATE(transaction_date AT TIME ZONE 'UTC') >= CURRENT_DATE - 6
          GROUP BY day
          ORDER BY day ASC`,
        [req.shopId]
      ),

      // Top 5 products this week (includes clothing variants)
      db.query(
        `SELECT COALESCE(cp.name, p.name) AS name,
                SUM(ti.quantity)           AS qty_sold,
                SUM(ti.subtotal)           AS revenue
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           LEFT JOIN products         p  ON p.id  = ti.product_id
           LEFT JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
           LEFT JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND DATE(t.transaction_date AT TIME ZONE 'UTC') >= CURRENT_DATE - 6
          GROUP BY COALESCE(cp.name, p.name)
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
      `-- Retail products
       SELECT id, name, stock_quantity, category,
              COALESCE(unit_type, 'unit') AS unit_type
         FROM products
        WHERE shop_id = $1 AND has_inventory = TRUE AND stock_quantity < $2
       UNION ALL
       -- Clothing variants
       SELECT cv.id,
              cp.name || ' / ' || cv.size || ' / ' || cv.color AS name,
              cv.stock_quantity,
              cp.category,
              'unit' AS unit_type
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.shop_id = $1 AND cv.is_active = TRUE
          AND cv.stock_quantity <= cv.low_stock_threshold
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

// ── GET /api/dashboard/analytics ─────────────────────────────
async function getAnalytics(req, res) {
  const { start_date, end_date } = req.query;
  const shopId = req.shopId;

  try {
    // Build date conditions for the transactions table directly
    const txParams = [shopId];
    const txDateConds = [];
    if (start_date) {
      txParams.push(start_date);
      txDateConds.push(`DATE(transaction_date AT TIME ZONE 'UTC') >= $${txParams.length}`);
    }
    if (end_date) {
      txParams.push(end_date);
      txDateConds.push(`DATE(transaction_date AT TIME ZONE 'UTC') <= $${txParams.length}`);
    }
    const txDateWhere = txDateConds.length ? `AND ${txDateConds.join(' AND ')}` : '';

    // Build date conditions for queries that JOIN through the transactions table
    const jtParams = [shopId];
    const jtDateConds = [];
    if (start_date) {
      jtParams.push(start_date);
      jtDateConds.push(`DATE(t.transaction_date AT TIME ZONE 'UTC') >= $${jtParams.length}`);
    }
    if (end_date) {
      jtParams.push(end_date);
      jtDateConds.push(`DATE(t.transaction_date AT TIME ZONE 'UTC') <= $${jtParams.length}`);
    }
    const jtDateWhere = jtDateConds.length ? `AND ${jtDateConds.join(' AND ')}` : '';

    const [ovRes, cogsRes, topProdsRes, dailyRes, inventoryRes] = await Promise.all([

      // Overview: revenue, tax, discounts, refunds, payment-method split
      db.query(`
        SELECT
          COALESCE(SUM(total_amount)    FILTER (WHERE status = 'completed'), 0) AS total_revenue,
          COALESCE(SUM(tax_amount)      FILTER (WHERE status = 'completed'), 0) AS total_tax,
          COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0) AS total_discounts,
          COALESCE(ABS(SUM(total_amount) FILTER (WHERE status = 'refunded'
                                                   AND refund_of IS NOT NULL)), 0) AS total_refunds,
          COUNT(*) FILTER (WHERE status = 'completed') AS transaction_count,
          COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='cash'),   0) AS cash_revenue,
          COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='card'),   0) AS card_revenue,
          COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='mobile'), 0) AS mobile_revenue,
          COALESCE(SUM(total_amount) FILTER (WHERE status='completed' AND payment_method='other'),  0) AS other_revenue
        FROM transactions
        WHERE shop_id = $1 ${txDateWhere}
      `, txParams),

      // Cost of goods sold + items sold (kg items count as 1, not by weight)
      db.query(`
        SELECT
          COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) AS total_cost,
          COALESCE(SUM(
            CASE WHEN COALESCE(p.unit_type, 'unit') = 'kg' THEN 1 ELSE ti.quantity END
          ), 0) AS items_sold
        FROM transaction_items ti
        JOIN  transactions t ON t.id = ti.transaction_id
        LEFT JOIN products  p ON p.id = ti.product_id
        WHERE t.shop_id = $1 AND t.status = 'completed' ${jtDateWhere}
      `, jtParams),

      // Top 20 products by revenue with profit breakdown
      db.query(`
        SELECT
          COALESCE(p.name, '[Deleted Product]')                        AS name,
          SUM(ti.quantity)::numeric                                     AS qty_sold,
          COALESCE(SUM(ti.subtotal), 0)                                AS revenue,
          COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0)   AS cost,
          COALESCE(SUM(ti.subtotal), 0)
            - COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) AS profit
        FROM transaction_items ti
        JOIN  transactions t ON t.id = ti.transaction_id
        LEFT JOIN products  p ON p.id = ti.product_id
        WHERE t.shop_id = $1 AND t.status = 'completed' ${jtDateWhere}
        GROUP BY p.name
        ORDER BY revenue DESC
        LIMIT 20
      `, jtParams),

      // Daily revenue trend for the selected period
      db.query(`
        SELECT
          DATE(transaction_date AT TIME ZONE 'UTC') AS day,
          COALESCE(SUM(total_amount), 0) AS revenue,
          COUNT(*)                        AS transactions
        FROM transactions
        WHERE shop_id = $1 AND status = 'completed' ${txDateWhere}
        GROUP BY day
        ORDER BY day ASC
      `, txParams),

      // Inventory snapshot (not date-filtered — always current)
      db.query(`
        SELECT
          COUNT(*)                                                                  AS total_products,
          COUNT(*) FILTER (WHERE has_inventory AND stock_quantity <= 0)            AS out_of_stock,
          COUNT(*) FILTER (WHERE has_inventory AND stock_quantity > 0
                                               AND stock_quantity < 10)            AS low_stock,
          COUNT(DISTINCT category) FILTER (WHERE category IS NOT NULL)             AS categories_count,
          COALESCE(SUM(stock_quantity * COALESCE(cost_price, 0))
                   FILTER (WHERE has_inventory), 0)                               AS stock_value
        FROM products
        WHERE shop_id = $1
      `, [shopId]),
    ]);

    const ov   = ovRes.rows[0];
    const cogs = cogsRes.rows[0];

    res.json({
      total_revenue:     Number(ov.total_revenue),
      total_tax:         Number(ov.total_tax),
      total_discounts:   Number(ov.total_discounts),
      total_refunds:     Number(ov.total_refunds),
      net_revenue:       Number(ov.total_revenue) - Number(ov.total_refunds),
      total_cost:        Number(cogs.total_cost),
      gross_profit:      Number(ov.total_revenue) - Number(cogs.total_cost),
      transaction_count: Number(ov.transaction_count),
      items_sold:        Number(cogs.items_sold),
      payment_methods: {
        cash:   Number(ov.cash_revenue),
        card:   Number(ov.card_revenue),
        mobile: Number(ov.mobile_revenue),
        other:  Number(ov.other_revenue),
      },
      daily_trend:  dailyRes.rows,
      top_products: topProdsRes.rows,
      inventory:    inventoryRes.rows[0],
    });
  } catch (err) {
    console.error('dashboard/analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Helper: fill in missing dates with 0 ─────────────────────
// All date arithmetic is done in UTC to match SQL's AT TIME ZONE 'UTC' grouping.
function fillDays(rows, count, fromMonthStart = false) {
  const map = {};
  rows.forEach((r) => { map[r.day.toISOString().split('T')[0]] = r; });

  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const result = [];
  for (let i = fromMonthStart ? 0 : count - 1; i >= 0; i--) {
    let key;
    if (fromMonthStart) {
      // i = 0 → day 1 of current UTC month, i = 1 → day 2, ...
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), i + 1));
      key = d.toISOString().split('T')[0];
    } else {
      // i = count-1 → oldest day, i = 0 → today
      const d = new Date(todayUtcMs - i * 86_400_000);
      key = d.toISOString().split('T')[0];
    }
    result.push(map[key] || { day: key, sales: '0', transactions: '0' });
  }
  return result;
}

module.exports = { getToday, getYesterday, getWeek, getMonth, getLowStock, getAnalytics };
