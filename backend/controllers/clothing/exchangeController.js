const db = require('../../config/database');

function genExchangeNumber(shopId) {
  const n = new Date();
  const p = (x, l) => String(x).padStart(l, '0');
  return `EXC-${shopId}-${n.getFullYear()}${p(n.getMonth()+1,2)}${p(n.getDate(),2)}-${Date.now().toString().slice(-6)}`;
}

// ── GET /api/clothing/transactions/lookup ─────────────────────
async function lookupTransaction(req, res) {
  const { txn_number, phone } = req.query;
  if (!txn_number && !phone) {
    return res.status(400).json({ error: 'txn_number or phone required' });
  }

  try {
    let txnRows;
    if (txn_number) {
      ({ rows: txnRows } = await db.query(
        `SELECT * FROM transactions
          WHERE shop_id = $1 AND transaction_number = $2 AND status = 'completed'`,
        [req.shopId, txn_number.trim()]
      ));
    } else {
      ({ rows: txnRows } = await db.query(
        `SELECT * FROM transactions
          WHERE shop_id = $1 AND customer_phone = $2 AND status = 'completed'
          ORDER BY transaction_date DESC LIMIT 10`,
        [req.shopId, phone.trim()]
      ));
    }

    if (!txnRows.length) return res.status(404).json({ error: 'Transaction not found' });

    const result = await Promise.all(txnRows.map(async (txn) => {
      const { rows: items } = await db.query(
        `SELECT ti.*,
                cv.size AS variant_size, cv.color AS variant_color,
                cp.name AS clothing_product_name,
                cp.id   AS clothing_product_id,
                COALESCE(cv.price_override, cp.base_price) AS effective_price
           FROM transaction_items ti
           LEFT JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
           LEFT JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE ti.transaction_id = $1`,
        [txn.id]
      );
      return { ...txn, items };
    }));

    res.json(txn_number ? result[0] : result);
  } catch (err) {
    console.error('lookupTransaction error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/exchanges ──────────────────────────────
async function processExchange(req, res) {
  const {
    original_transaction_id,
    customer_phone = '',
    returned_items = [],  // [{ variant_id, quantity, original_transaction_item_id }]
    issued_items   = [],  // [{ variant_id, quantity }]
    note = '',
  } = req.body;

  if (!original_transaction_id || !returned_items.length) {
    return res.status(400).json({ error: 'original_transaction_id and returned_items required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Verify original transaction belongs to this shop
    const { rows: txnRows } = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND shop_id = $2`,
      [original_transaction_id, req.shopId]
    );
    if (!txnRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Original transaction not found' });
    }

    // 2. Validate returned items are in original transaction
    let returnedValue = 0;
    for (const ri of returned_items) {
      const { rows } = await client.query(
        `SELECT ti.*, COALESCE(cv.price_override, cp.base_price) AS price
           FROM transaction_items ti
           LEFT JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
           LEFT JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE ti.id = $1 AND ti.transaction_id = $2`,
        [ri.original_transaction_item_id, original_transaction_id]
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Item ${ri.original_transaction_item_id} not in original transaction` });
      }
      const origQty = parseFloat(rows[0].quantity);
      if (ri.quantity > origQty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cannot return more than purchased quantity for item ${ri.original_transaction_item_id}` });
      }
      ri._unit_price = parseFloat(rows[0].unit_price);
      ri._subtotal   = ri._unit_price * ri.quantity;
      returnedValue += ri._subtotal;
    }

    // 3. Validate issued items have enough stock
    let issuedValue = 0;
    for (const ii of issued_items) {
      const { rows } = await client.query(
        `SELECT cv.*, COALESCE(cv.price_override, cp.base_price) AS price
           FROM clothing_variants cv
           JOIN clothing_products cp ON cp.id = cv.product_id
          WHERE cv.id = $1 AND cv.shop_id = $2`,
        [ii.variant_id, req.shopId]
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Variant ${ii.variant_id} not found` });
      }
      if (rows[0].stock_quantity < ii.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for variant ${ii.variant_id}` });
      }
      ii._unit_price = parseFloat(rows[0].price);
      ii._subtotal   = ii._unit_price * ii.quantity;
      issuedValue   += ii._subtotal;
    }

    const net_refund = returnedValue - issuedValue;
    const exchangeNumber = genExchangeNumber(req.shopId);

    // 4. Insert exchange record
    const { rows: excRows } = await client.query(
      `INSERT INTO clothing_exchanges
         (shop_id, user_id, original_transaction_id, exchange_number,
          customer_phone, net_refund_amount, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.shopId, req.user.id, original_transaction_id, exchangeNumber,
       customer_phone, net_refund, note]
    );
    const exc = excRows[0];

    // 5. Insert exchange items + update stock
    for (const ri of returned_items) {
      await client.query(
        `INSERT INTO clothing_exchange_items
           (exchange_id, direction, variant_id, quantity, unit_price, subtotal)
         VALUES ($1,'returned',$2,$3,$4,$5)`,
        [exc.id, ri.variant_id, ri.quantity, ri._unit_price, ri._subtotal]
      );
      await client.query(
        `UPDATE clothing_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
        [ri.quantity, ri.variant_id]
      );
      await client.query(
        `INSERT INTO clothing_stock_adjustments
           (shop_id, variant_id, user_id, delta, reason, reference_id)
         VALUES ($1,$2,$3,$4,'return',$5)`,
        [req.shopId, ri.variant_id, req.user.id, ri.quantity, exc.id]
      );
    }

    for (const ii of issued_items) {
      await client.query(
        `INSERT INTO clothing_exchange_items
           (exchange_id, direction, variant_id, quantity, unit_price, subtotal)
         VALUES ($1,'issued',$2,$3,$4,$5)`,
        [exc.id, ii.variant_id, ii.quantity, ii._unit_price, ii._subtotal]
      );
      await client.query(
        `UPDATE clothing_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [ii.quantity, ii.variant_id]
      );
      await client.query(
        `INSERT INTO clothing_stock_adjustments
           (shop_id, variant_id, user_id, delta, reason, reference_id)
         VALUES ($1,$2,$3,$4,'exchange',$5)`,
        [req.shopId, ii.variant_id, req.user.id, -ii.quantity, exc.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(exc);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('processExchange error:', err);
    res.status(500).json({ error: 'Server error processing exchange' });
  } finally { client.release(); }
}

// ── GET /api/clothing/exchanges ──────────────────────────────
async function listExchanges(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT ce.*, u.username AS cashier
         FROM clothing_exchanges ce
         LEFT JOIN users u ON u.id = ce.user_id
        WHERE ce.shop_id = $1
        ORDER BY ce.created_at DESC LIMIT 100`,
      [req.shopId]
    );
    res.json({ exchanges: rows });
  } catch (err) {
    console.error('listExchanges error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/exchanges/:id ──────────────────────────
async function getExchange(req, res) {
  try {
    const { rows: excRows } = await db.query(
      `SELECT * FROM clothing_exchanges WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (!excRows.length) return res.status(404).json({ error: 'Exchange not found' });

    const { rows: items } = await db.query(
      `SELECT cei.*, cv.size, cv.color, cp.name AS product_name
         FROM clothing_exchange_items cei
         JOIN clothing_variants cv ON cv.id = cei.variant_id
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cei.exchange_id = $1`,
      [req.params.id]
    );
    res.json({ ...excRows[0], items });
  } catch (err) {
    console.error('getExchange error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { lookupTransaction, processExchange, listExchanges, getExchange };
