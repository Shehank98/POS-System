const db = require('../config/database');

// ── Token generation helpers ──────────────────────────────────
// Format: A001–A999, B001–B999, ... (resets daily per shop)
function parseToken(token) {
  if (!token || token.length < 2) return null;
  const letter = token[0].toUpperCase();
  const num = parseInt(token.slice(1), 10);
  if (!/[A-Z]/.test(letter) || isNaN(num)) return null;
  return { letter, num };
}

function buildToken(letter, num) {
  return `${letter}${String(num).padStart(3, '0')}`;
}

function incrementToken(token) {
  const parsed = parseToken(token);
  if (!parsed) return 'A001';
  if (parsed.num >= 999) {
    // Roll to next letter
    const nextLetter = String.fromCharCode(parsed.letter.charCodeAt(0) + 1);
    if (nextLetter > 'Z') return 'A001'; // full wraparound (26,000 tokens/day is enough)
    return buildToken(nextLetter, 1);
  }
  return buildToken(parsed.letter, parsed.num + 1);
}

async function generateToken(shop_id) {
  const { rows } = await db.query(
    `SELECT token_number FROM pre_orders
      WHERE shop_id = $1
        AND created_at::date = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1`,
    [shop_id]
  );
  if (rows.length === 0) return 'A001';
  return incrementToken(rows[0].token_number);
}

// ── PUBLIC: GET /api/pre-orders/public/products?shop_id=X ─────
async function getPublicProducts(req, res) {
  const { shop_id } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

  try {
    const { rows } = await db.query(
      `SELECT id, name, price, category, stock_quantity, has_inventory
         FROM products
        WHERE shop_id = $1
        ORDER BY
          CASE
            WHEN has_inventory = true AND stock_quantity <= 0 THEN 1
            ELSE 0
          END ASC,
          category ASC,
          name ASC`,
      [shop_id]
    );
    res.json({ products: rows });
  } catch (err) {
    console.error('getPublicProducts error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── PUBLIC: GET /api/pre-orders/public/shop?shop_id=X ─────────
async function getPublicShop(req, res) {
  const { shop_id } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

  try {
    // Use only base-schema columns (id, name always exist)
    const { rows } = await db.query(
      `SELECT id, name FROM shops WHERE id = $1`,
      [shop_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const shop = { ...rows[0], logo_url: null };

    // logo_url was added in migration 005 — try to fetch it gracefully
    try {
      const { rows: extra } = await db.query(
        `SELECT logo_url FROM shops WHERE id = $1`, [shop_id]
      );
      if (extra.length > 0) shop.logo_url = extra[0].logo_url || null;
    } catch { /* column may not exist yet — continue without logo */ }

    res.json({ shop });
  } catch (err) {
    console.error('getPublicShop error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── PUBLIC: POST /api/pre-orders/public ───────────────────────
async function createPreOrder(req, res) {
  const { shop_id, customer_phone, customer_name, items, total_amount } = req.body;

  // Basic validation
  if (!shop_id)          return res.status(400).json({ error: 'shop_id is required' });
  if (!customer_phone)   return res.status(400).json({ error: 'customer_phone is required' });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items must be a non-empty array' });
  if (total_amount === undefined || total_amount === null || isNaN(Number(total_amount)))
    return res.status(400).json({ error: 'total_amount is required' });

  try {
    // Verify shop exists
    const { rows: shopRows } = await db.query(
      `SELECT id FROM shops WHERE id = $1`,
      [shop_id]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    // Generate token (with basic concurrency safety via advisory lock not needed at this scale)
    const token_number = await generateToken(shop_id);

    const { rows } = await db.query(
      `INSERT INTO pre_orders
         (shop_id, customer_phone, customer_name, items, total_amount, status, token_number)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       RETURNING id, token_number, status, created_at`,
      [
        shop_id,
        customer_phone.trim(),
        customer_name ? customer_name.trim() : null,
        JSON.stringify(items),
        Number(total_amount),
        token_number,
      ]
    );

    res.status(201).json({ success: true, token: rows[0].token_number, orderId: rows[0].id });
  } catch (err) {
    console.error('createPreOrder error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUBLIC: GET /api/pre-orders/public/history?shop_id=X&phone=Y
async function getOrderHistory(req, res) {
  const { shop_id, phone } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });
  if (!phone)   return res.status(400).json({ error: 'phone is required' });

  try {
    const { rows } = await db.query(
      `SELECT id, token_number, items, total_amount, status, created_at
         FROM pre_orders
        WHERE shop_id = $1 AND customer_phone = $2
        ORDER BY created_at DESC
        LIMIT 5`,
      [shop_id, phone.trim()]
    );
    res.json({ orders: rows });
  } catch (err) {
    console.error('getOrderHistory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── AUTHENTICATED: GET /api/pre-orders?status=PENDING ─────────
async function listPreOrders(req, res) {
  const { status } = req.query;
  const validStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  try {
    let query = `SELECT * FROM pre_orders WHERE shop_id = $1`;
    const params = [req.shopId];

    if (status && validStatuses.includes(status.toUpperCase())) {
      query += ` AND status = $2`;
      params.push(status.toUpperCase());
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await db.query(query, params);
    res.json({ orders: rows });
  } catch (err) {
    console.error('listPreOrders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── AUTHENTICATED: PUT /api/pre-orders/:id/status ─────────────
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const { rows } = await db.query(
      `UPDATE pre_orders SET status = $1
        WHERE id = $2 AND shop_id = $3
       RETURNING *`,
      [status.toUpperCase(), id, req.shopId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pre-order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── AUTHENTICATED: GET /api/pre-orders/by-token/:token ────────
async function getByToken(req, res) {
  const { token } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT * FROM pre_orders
        WHERE shop_id = $1
          AND token_number = $2
          AND status IN ('PENDING', 'PREPARING', 'READY')
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.shopId, token.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pre-order not found or already completed' });
    res.json({ order: rows[0] });
  } catch (err) {
    console.error('getByToken error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Cron: cancel stale PENDING orders older than 2 hours ──────
async function cancelStalePreOrders() {
  try {
    const { rowCount } = await db.query(
      `UPDATE pre_orders SET status = 'CANCELLED'
        WHERE status = 'PENDING'
          AND created_at < NOW() - INTERVAL '2 hours'`
    );
    if (rowCount > 0) {
      console.log(`[Cron] Cancelled ${rowCount} stale pre-order(s)`);
    }
  } catch (err) {
    console.error('[Cron] cancelStalePreOrders error:', err);
  }
}

module.exports = {
  getPublicProducts,
  getPublicShop,
  createPreOrder,
  getOrderHistory,
  listPreOrders,
  updateStatus,
  getByToken,
  cancelStalePreOrders,
};
