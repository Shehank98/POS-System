const db = require('../../config/database');

// ── GET /api/clothing/reports/best-sizes ─────────────────────
async function bestSizes(req, res) {
  const { start, end } = req.query;
  const params = [req.shopId];
  const dateFilter = [];

  if (start) { params.push(start); dateFilter.push(`t.transaction_date >= $${params.length}`); }
  if (end)   { params.push(end + ' 23:59:59'); dateFilter.push(`t.transaction_date <= $${params.length}`); }
  const dw = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT cv.size,
              SUM(ti.quantity)            AS total_qty,
              SUM(ti.subtotal)            AS total_revenue
         FROM transaction_items ti
         JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
         JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.shop_id = $1 AND t.status = 'completed' ${dw}
        GROUP BY cv.size
        ORDER BY total_qty DESC`,
      params
    );
    res.json({ sizes: rows });
  } catch (err) {
    console.error('bestSizes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/reports/best-colors ────────────────────
async function bestColors(req, res) {
  const { start, end } = req.query;
  const params = [req.shopId];
  const dateFilter = [];

  if (start) { params.push(start); dateFilter.push(`t.transaction_date >= $${params.length}`); }
  if (end)   { params.push(end + ' 23:59:59'); dateFilter.push(`t.transaction_date <= $${params.length}`); }
  const dw = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT cv.color,
              SUM(ti.quantity)  AS total_qty,
              SUM(ti.subtotal)  AS total_revenue
         FROM transaction_items ti
         JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
         JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.shop_id = $1 AND t.status = 'completed' ${dw}
        GROUP BY cv.color
        ORDER BY total_qty DESC`,
      params
    );
    res.json({ colors: rows });
  } catch (err) {
    console.error('bestColors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/reports/daily-sales ────────────────────
async function dailySales(req, res) {
  const { start, end } = req.query;
  const params = [req.shopId];
  const dateFilter = [];

  if (start) { params.push(start); dateFilter.push(`t.transaction_date >= $${params.length}`); }
  if (end)   { params.push(end + ' 23:59:59'); dateFilter.push(`t.transaction_date <= $${params.length}`); }
  const dw = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT DATE(t.transaction_date) AS day,
              COUNT(DISTINCT t.id)     AS txn_count,
              SUM(t.total_amount)      AS revenue,
              SUM(ti.quantity) FILTER (WHERE ti.clothing_variant_id IS NOT NULL) AS units_sold
         FROM transactions t
         LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.shop_id = $1 AND t.status = 'completed' ${dw}
        GROUP BY DATE(t.transaction_date)
        ORDER BY day ASC`,
      params
    );
    res.json({ daily: rows });
  } catch (err) {
    console.error('dailySales error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/dashboard ──────────────────────────────
async function dashboard(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [salesRow, exchangeRow, lowRow, recentRow] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS txn_count,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COALESCE(SUM(ti.quantity) FILTER (WHERE ti.clothing_variant_id IS NOT NULL), 0) AS units_sold
           FROM transactions t
           LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
          WHERE t.shop_id = $1 AND t.status = 'completed'
            AND DATE(t.transaction_date) = $2`,
        [req.shopId, today]
      ),
      db.query(
        `SELECT COUNT(*) AS exchange_count
           FROM clothing_exchanges
          WHERE shop_id = $1 AND DATE(created_at) = $2`,
        [req.shopId, today]
      ),
      db.query(
        `SELECT COUNT(*) AS low_count
           FROM clothing_variants cv
          WHERE cv.shop_id = $1 AND cv.is_active = TRUE
            AND cv.stock_quantity <= cv.low_stock_threshold`,
        [req.shopId]
      ),
      db.query(
        `SELECT t.id, t.transaction_number, t.total_amount, t.transaction_date
           FROM transactions t
          WHERE t.shop_id = $1 AND t.status = 'completed'
          ORDER BY t.transaction_date DESC LIMIT 5`,
        [req.shopId]
      ),
    ]);

    res.json({
      today: {
        ...salesRow.rows[0],
        exchange_count: exchangeRow.rows[0].exchange_count,
        low_stock_count: lowRow.rows[0].low_count,
      },
      recent_transactions: recentRow.rows,
    });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { bestSizes, bestColors, dailySales, dashboard };
