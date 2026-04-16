const db = require('../config/database');

// ── Token generation helpers ──────────────────────────────────
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
    const nextLetter = String.fromCharCode(parsed.letter.charCodeAt(0) + 1);
    if (nextLetter > 'Z') return 'A001';
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

// ── Cancellation tracking helpers ─────────────────────────────
async function getCancellationRecord(shop_id, phone) {
  const { rows } = await db.query(
    `SELECT * FROM customer_cancellation_tracking
      WHERE shop_id = $1 AND customer_phone = $2`,
    [shop_id, phone.trim()]
  );
  return rows[0] || null;
}

async function upsertCancellationTracking(shop_id, phone, { incrementOrders = false, incrementCancellations = false } = {}) {
  const now = new Date();

  // Build increment expressions
  const orderInc  = incrementOrders       ? 'total_orders + 1'        : 'total_orders';
  const cancelInc = incrementCancellations ? 'total_cancellations + 1' : 'total_cancellations';

  // Calculate cooldown: applied when total_cancellations reaches 3 after increment
  // We check after increment so if new count >= 3 we set cooldown
  const { rows } = await db.query(
    `INSERT INTO customer_cancellation_tracking
       (shop_id, customer_phone, total_orders, total_cancellations, last_order_date, updated_at)
     VALUES ($1, $2,
       ${incrementOrders ? 1 : 0},
       ${incrementCancellations ? 1 : 0},
       $3, $3)
     ON CONFLICT (shop_id, customer_phone) DO UPDATE SET
       total_orders         = ${orderInc},
       total_cancellations  = ${cancelInc},
       last_order_date      = CASE WHEN $4 THEN $3 ELSE customer_cancellation_tracking.last_order_date END,
       cooldown_until       = CASE
         WHEN ${cancelInc} >= 3 THEN NOW() + INTERVAL '12 hours'
         ELSE customer_cancellation_tracking.cooldown_until
       END,
       updated_at           = $3
     RETURNING *`,
    [shop_id, phone.trim(), now, incrementOrders]
  );
  return rows[0];
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
    const { rows } = await db.query(
      `SELECT id, name FROM shops WHERE id = $1`,
      [shop_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const shop = { ...rows[0], logo_url: null };
    try {
      const { rows: extra } = await db.query(
        `SELECT logo_url FROM shops WHERE id = $1`, [shop_id]
      );
      if (extra.length > 0) shop.logo_url = extra[0].logo_url || null;
    } catch { /* column may not exist yet */ }

    res.json({ shop });
  } catch (err) {
    console.error('getPublicShop error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── PUBLIC: GET /api/pre-orders/public/cancellation-status ────
// Returns cancellation info for a phone number so the customer
// order page can show warnings / block placement.
async function getCancellationStatus(req, res) {
  const { shop_id, phone } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });
  if (!phone)   return res.status(400).json({ error: 'phone is required' });

  try {
    const record = await getCancellationRecord(shop_id, phone);
    if (!record) {
      return res.json({ total_cancellations: 0, cooldown_active: false, cooldown_until: null });
    }

    const now = new Date();
    const cooldown_active = record.cooldown_until && new Date(record.cooldown_until) > now;

    res.json({
      total_cancellations: record.total_cancellations,
      total_orders:        record.total_orders,
      cooldown_active:     !!cooldown_active,
      cooldown_until:      cooldown_active ? record.cooldown_until : null,
    });
  } catch (err) {
    // If table doesn't exist yet (pre-migration), return safe defaults
    console.error('getCancellationStatus error:', err.message);
    res.json({ total_cancellations: 0, cooldown_active: false, cooldown_until: null });
  }
}

// ── PUBLIC: POST /api/pre-orders/public ───────────────────────
async function createPreOrder(req, res) {
  const { shop_id, customer_phone, customer_name, items, total_amount } = req.body;

  if (!shop_id)        return res.status(400).json({ error: 'shop_id is required' });
  if (!customer_phone) return res.status(400).json({ error: 'customer_phone is required' });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items must be a non-empty array' });
  if (total_amount === undefined || total_amount === null || isNaN(Number(total_amount)))
    return res.status(400).json({ error: 'total_amount is required' });

  const phone = customer_phone.trim();

  try {
    // Verify shop exists
    const { rows: shopRows } = await db.query(
      `SELECT id FROM shops WHERE id = $1`, [shop_id]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    // Check cooldown restriction
    try {
      const record = await getCancellationRecord(shop_id, phone);
      if (record && record.cooldown_until && new Date(record.cooldown_until) > new Date()) {
        const until = new Date(record.cooldown_until);
        const hoursLeft = Math.ceil((until - new Date()) / 3600000);
        return res.status(403).json({
          error: `Pre-order temporarily disabled due to repeated cancellations. Try again after ${hoursLeft} hour(s).`,
          code: 'COOLDOWN_ACTIVE',
          cooldown_until: record.cooldown_until,
        });
      }
    } catch (checkErr) {
      // Table may not exist yet — continue without restriction
      console.warn('Cancellation check skipped:', checkErr.message);
    }

    const token_number = await generateToken(shop_id);

    const { rows } = await db.query(
      `INSERT INTO pre_orders
         (shop_id, customer_phone, customer_name, items, total_amount, status, token_number)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       RETURNING id, token_number, status, created_at`,
      [
        shop_id,
        phone,
        customer_name ? customer_name.trim() : null,
        JSON.stringify(items),
        Number(total_amount),
        token_number,
      ]
    );

    // Track the new order (best effort — don't fail the order if tracking fails)
    upsertCancellationTracking(shop_id, phone, { incrementOrders: true })
      .catch((e) => console.warn('cancellation tracking upsert failed:', e.message));

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
      `SELECT id, token_number, items, total_amount, status, payment_status, created_at
         FROM pre_orders
        WHERE shop_id = $1 AND customer_phone = $2
        ORDER BY created_at DESC
        LIMIT 10`,
      [shop_id, phone.trim()]
    );
    res.json({ orders: rows });
  } catch (err) {
    // payment_status column may not exist yet — fall back without it
    try {
      const { rows } = await db.query(
        `SELECT id, token_number, items, total_amount, status, created_at
           FROM pre_orders
          WHERE shop_id = $1 AND customer_phone = $2
          ORDER BY created_at DESC
          LIMIT 10`,
        [shop_id, phone.trim()]
      );
      res.json({ orders: rows.map((r) => ({ ...r, payment_status: 'pending' })) });
    } catch (fallbackErr) {
      console.error('getOrderHistory error:', fallbackErr);
      res.status(500).json({ error: 'Server error' });
    }
  }
}

// ── AUTHENTICATED: GET /api/pre-orders/counts ─────────────────
// Returns order count per status for notification badges.
async function getStatusCounts(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT status, COUNT(*) AS count
         FROM pre_orders
        WHERE shop_id = $1
          AND created_at::date = CURRENT_DATE
        GROUP BY status`,
      [req.shopId]
    );

    const counts = { PENDING: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 };
    rows.forEach((r) => { counts[r.status] = parseInt(r.count, 10); });
    res.json(counts);
  } catch (err) {
    console.error('getStatusCounts error:', err);
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

    // Gracefully handle missing payment_status column (pre-migration)
    const orders = rows.map((r) => ({ payment_status: 'pending', ...r }));
    res.json({ orders });
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

    const order = rows[0];

    // Track cancellations (best effort — don't fail status update)
    if (status.toUpperCase() === 'CANCELLED' && order.customer_phone) {
      upsertCancellationTracking(req.shopId, order.customer_phone, { incrementCancellations: true })
        .then((record) => {
          if (record && record.total_cancellations === 2) {
            // Log for visibility — warning is shown on front-end via cancellation-status API
            console.log(`[PreOrder] Warning: ${order.customer_phone} has 2 cancellations`);
          }
          if (record && record.total_cancellations >= 3) {
            console.log(`[PreOrder] Cooldown applied: ${order.customer_phone} until ${record.cooldown_until}`);
          }
        })
        .catch((e) => console.warn('cancellation tracking failed:', e.message));
    }

    res.json({ order: { payment_status: 'pending', ...order } });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── AUTHENTICATED: PUT /api/pre-orders/:id/pay ────────────────
async function markAsPaid(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `UPDATE pre_orders SET payment_status = 'paid'
        WHERE id = $1 AND shop_id = $2
       RETURNING *`,
      [id, req.shopId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pre-order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    console.error('markAsPaid error:', err);
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
    res.json({ order: { payment_status: 'pending', ...rows[0] } });
  } catch (err) {
    console.error('getByToken error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Cron: cancel stale PENDING orders older than 2 hours ──────
async function cancelStalePreOrders() {
  try {
    const { rows: stale } = await db.query(
      `UPDATE pre_orders SET status = 'CANCELLED'
        WHERE status = 'PENDING'
          AND created_at < NOW() - INTERVAL '2 hours'
       RETURNING shop_id, customer_phone`
    );
    if (stale.length > 0) {
      console.log(`[Cron] Cancelled ${stale.length} stale pre-order(s)`);
      // Track stale cancellations (auto-cancels also count)
      for (const row of stale) {
        if (row.customer_phone) {
          upsertCancellationTracking(row.shop_id, row.customer_phone, { incrementCancellations: true })
            .catch((e) => console.warn('stale cancel tracking failed:', e.message));
        }
      }
    }
  } catch (err) {
    console.error('[Cron] cancelStalePreOrders error:', err);
  }
}

// ── PUBLIC: GET /api/pre-orders/public/track?shop_id=X&token=Y ─
async function getPublicTrack(req, res) {
  const { shop_id, token } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });
  if (!token)   return res.status(400).json({ error: 'token is required' });

  try {
    const { rows } = await db.query(
      `SELECT po.id, po.token_number, po.status, po.items,
              po.total_amount, po.customer_name, po.created_at,
              COALESCE(po.payment_status, 'pending') AS payment_status,
              s.name AS shop_name
         FROM pre_orders po
         JOIN shops s ON s.id = po.shop_id
        WHERE po.shop_id = $1
          AND po.token_number = $2
        ORDER BY po.created_at DESC
        LIMIT 1`,
      [shop_id, token.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    console.error('getPublicTrack error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── AUTHENTICATED: GET /api/pre-orders/stats ──────────────────
async function getStats(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')                                        AS pending_count,
         COUNT(*) FILTER (WHERE status = 'PREPARING')                                      AS preparing_count,
         COUNT(*) FILTER (WHERE status = 'READY')                                          AS ready_count,
         COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND status != 'CANCELLED') AS today_count,
         COALESCE(SUM(total_amount) FILTER (
           WHERE created_at::date = CURRENT_DATE AND status != 'CANCELLED'
         ), 0)                                                                              AS today_amount,
         COUNT(*) FILTER (
           WHERE created_at >= CURRENT_DATE - INTERVAL '6 days' AND status != 'CANCELLED'
         )                                                                                  AS this_week_count
       FROM pre_orders
       WHERE shop_id = $1`,
      [req.shopId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

module.exports = {
  getPublicProducts,
  getPublicShop,
  getCancellationStatus,
  createPreOrder,
  getOrderHistory,
  getStatusCounts,
  listPreOrders,
  updateStatus,
  markAsPaid,
  getByToken,
  getPublicTrack,
  getStats,
  cancelStalePreOrders,
};
