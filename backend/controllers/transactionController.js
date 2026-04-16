const db = require('../config/database');

// ── Helper: generate transaction number ───────────────────────
function generateTxnNumber(shopId) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `TXN-${shopId}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Date.now().toString().slice(-6)}`;
}

// ── POST /api/transactions ────────────────────────────────────
async function createTransaction(req, res) {
  const {
    items,            // [{ product_id, quantity, unit_price, discount }]
    payment_method = 'cash',
    discount_amount = 0,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    let subtotalSum = 0;
    let taxSum = 0;
    const enrichedItems = [];

    for (const item of items) {
      const { rows } = await client.query(
        `SELECT id, name, price, tax_rate, has_inventory, stock_quantity,
                COALESCE(unit_type, 'unit') AS unit_type
           FROM products WHERE id = $1 AND shop_id = $2`,
        [item.product_id, req.shopId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product ${item.product_id} not found` });
      }

      const product = rows[0];
      const qty     = parseFloat(item.quantity) || 1;
      const price   = parseFloat(item.unit_price) ?? parseFloat(product.price);
      const disc    = parseFloat(item.discount) || 0;
      const subtotal = (price * qty) - disc;
      const taxAmount = subtotal * (parseFloat(product.tax_rate) / 100);

      subtotalSum += subtotal;
      taxSum      += taxAmount;

      // Deduct stock if inventory is tracked
      if (product.has_inventory) {
        const available = parseFloat(product.stock_quantity);
        if (available < qty) {
          await client.query('ROLLBACK');
          const unit = product.unit_type === 'kg' ? 'KG' : 'units';
          return res.status(400).json({
            error: `Insufficient stock for "${product.name}". Available: ${available} ${unit}`
          });
        }
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
          [qty, product.id]
        );
      }

      enrichedItems.push({ product_id: product.id, quantity: qty, unit_price: price, discount: disc, subtotal });
    }

    const totalAmount = subtotalSum + taxSum - parseFloat(discount_amount);
    const txnNumber   = generateTxnNumber(req.shopId);

    const { rows: txnRows } = await client.query(
      `INSERT INTO transactions
         (shop_id, user_id, transaction_number, total_amount, tax_amount, discount_amount, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'completed')
       RETURNING *`,
      [req.shopId, req.user.id, txnNumber, totalAmount, taxSum, discount_amount, payment_method]
    );

    const txn = txnRows[0];

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, discount, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [txn.id, item.product_id, item.quantity, item.unit_price, item.discount, item.subtotal]
      );
    }

    await client.query('COMMIT');

    // Return full transaction with items
    const { rows: fullItems } = await db.query(
      `SELECT ti.*, p.name AS product_name
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = $1`,
      [txn.id]
    );

    res.status(201).json({ ...txn, items: fullItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createTransaction error:', err);
    res.status(500).json({ error: 'Server error creating transaction' });
  } finally {
    client.release();
  }
}

// ── GET /api/transactions ─────────────────────────────────────
async function listTransactions(req, res) {
  const {
    start_date, end_date,
    payment_method, status,
    page = 1, limit = 50,
  } = req.query;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const params = [req.shopId];
  const conditions = ['t.shop_id = $1'];

  if (start_date) {
    params.push(start_date);
    conditions.push(`t.transaction_date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date + ' 23:59:59');
    conditions.push(`t.transaction_date <= $${params.length}`);
  }
  if (payment_method) {
    params.push(payment_method);
    conditions.push(`t.payment_method = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM transactions t WHERE ${where}`, params
    );
    params.push(parseInt(limit, 10), offset);
    const { rows } = await db.query(
      `SELECT t.*, u.username AS cashier
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
        WHERE ${where}
        ORDER BY t.transaction_date DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      transactions: rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('listTransactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/transactions/:id ─────────────────────────────────
async function getTransaction(req, res) {
  try {
    const { rows: txnRows } = await db.query(
      `SELECT t.*, u.username AS cashier
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
        WHERE t.id = $1 AND t.shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (txnRows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    const { rows: items } = await db.query(
      `SELECT ti.*, p.name AS product_name
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = $1`,
      [req.params.id]
    );
    res.json({ ...txnRows[0], items });
  } catch (err) {
    console.error('getTransaction error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/transactions/:id/void ──────────────────────────
async function voidTransaction(req, res) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (rows[0].status !== 'completed') {
      await client.query('ROLLBACK');
      const msg = rows[0].status === 'void'
        ? 'This transaction has already been voided'
        : 'Only completed transactions can be voided';
      return res.status(400).json({ error: msg });
    }

    // Restore stock (LEFT JOIN so items with deleted products are not skipped)
    const { rows: items } = await client.query(
      `SELECT ti.product_id, ti.quantity, p.has_inventory
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = $1`,
      [req.params.id]
    );
    for (const item of items) {
      if (item.has_inventory && item.product_id) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
          [parseFloat(item.quantity), item.product_id]
        );
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE transactions SET status = 'void' WHERE id = $1 AND shop_id = $2 RETURNING *`,
      [req.params.id, req.shopId]
    );

    if (!updated.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found or already modified' });
    }

    // Commit real work BEFORE audit trail — audit failure must never roll back the void
    await client.query('COMMIT');

    // Audit trail — fire-and-forget after commit (best effort)
    db.query(
      `INSERT INTO deleted_records
         (shop_id, record_type, record_id, deleted_by, original_data)
       VALUES ($1, 'transaction_void', $2, $3, $4::jsonb)`,
      [req.shopId, rows[0].id, req.user.id, JSON.stringify(rows[0])]
    ).catch((auditErr) =>
      console.error('void audit trail (non-fatal):', auditErr.message)
    );

    res.json(updated[0]);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('voidTransaction error — code:', err.code,
                  '| message:', err.message, '| detail:', err.detail);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  } finally {
    client.release();
  }
}

// ── POST /api/transactions/:id/refund ─────────────────────────
async function refundTransaction(req, res) {
  const { items: refundItems, reason = '' } = req.body;

  if (!Array.isArray(refundItems) || refundItems.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Fetch original transaction
    const { rows: txnRows } = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (txnRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const original = txnRows[0];
    if (original.status === 'void') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot refund a voided transaction' });
    }

    // Fetch original line items
    const { rows: origItems } = await client.query(
      `SELECT ti.*, p.has_inventory, p.tax_rate
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = $1`,
      [original.id]
    );

    // Validate refund items and build enriched list
    let refundSubtotal = 0;
    let refundTax = 0;
    const enriched = [];

    for (const ri of refundItems) {
      const orig = origItems.find((o) => o.id === ri.transaction_item_id);
      if (!orig) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Line item ${ri.transaction_item_id} not found in original transaction`,
        });
      }
      const qty = parseFloat(ri.quantity) || orig.quantity;
      if (qty > parseFloat(orig.quantity)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Cannot refund more than original quantity for item ${orig.id}`,
        });
      }

      // Proportional unit price & discount
      const ratio    = qty / parseFloat(orig.quantity);
      const subtotal = parseFloat(orig.subtotal) * ratio;
      const taxRate  = parseFloat(orig.tax_rate || 0);
      const taxAmt   = (parseFloat(orig.unit_price) * qty - parseFloat(orig.discount) * ratio)
                       * (taxRate / 100);

      refundSubtotal += subtotal;
      refundTax      += taxAmt;

      enriched.push({
        product_id: orig.product_id,
        quantity:   qty,
        unit_price: orig.unit_price,
        discount:   parseFloat(orig.discount) * ratio,
        subtotal,
        has_inventory: orig.has_inventory,
      });
    }

    const refundTotal  = -(refundSubtotal + refundTax); // negative
    const txnNumber    = `REF-${original.transaction_number}`;

    // Create refund transaction (negative total)
    const { rows: refRows } = await client.query(
      `INSERT INTO transactions
         (shop_id, user_id, transaction_number, total_amount, tax_amount,
          discount_amount, payment_method, status, refund_of)
       VALUES ($1,$2,$3,$4,$5,0,$6,'refunded',$7)
       RETURNING *`,
      [req.shopId, req.user.id, txnNumber, refundTotal, -refundTax,
       original.payment_method, original.id]
    );
    const refundTxn = refRows[0];

    // Insert refund line items and restore stock
    for (const item of enriched) {
      await client.query(
        `INSERT INTO transaction_items
           (transaction_id, product_id, quantity, unit_price, discount, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [refundTxn.id, item.product_id, item.quantity,
         item.unit_price, item.discount, item.subtotal]
      );

      if (item.has_inventory && item.product_id) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query('COMMIT');

    const { rows: fullItems } = await db.query(
      `SELECT ti.*, p.name AS product_name
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
        WHERE ti.transaction_id = $1`,
      [refundTxn.id]
    );

    res.status(201).json({ ...refundTxn, items: fullItems, reason });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('refundTransaction error:', err);
    res.status(500).json({ error: 'Server error creating refund' });
  } finally {
    client.release();
  }
}

// ── GET /api/transactions/summary ────────────────────────────
async function getSummary(req, res) {
  const { start_date, end_date } = req.query;
  const params = [req.shopId];
  const dateFilter = [];

  if (start_date) {
    params.push(start_date);
    dateFilter.push(`transaction_date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date + ' 23:59:59');
    dateFilter.push(`transaction_date <= $${params.length}`);
  }

  const dateWhere = dateFilter.length ? ' AND ' + dateFilter.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')              AS total_transactions,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
         COALESCE(SUM(tax_amount)   FILTER (WHERE status = 'completed'), 0) AS total_tax,
         COALESCE(SUM(discount_amount) FILTER (WHERE status='completed'), 0) AS total_discounts,
         COUNT(*) FILTER (WHERE status = 'void')                   AS voided_transactions,
         COUNT(*) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL) AS refund_transactions,
         COALESCE(ABS(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL)), 0) AS total_refunds,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0)
           + COALESCE(SUM(total_amount) FILTER (WHERE status = 'refunded' AND refund_of IS NOT NULL), 0) AS net_revenue,
         COUNT(*) FILTER (WHERE payment_method='cash' AND status='completed')   AS cash_count,
         COUNT(*) FILTER (WHERE payment_method='card' AND status='completed')   AS card_count,
         COUNT(*) FILTER (WHERE payment_method='mobile' AND status='completed') AS mobile_count
       FROM transactions
       WHERE shop_id = $1 ${dateWhere}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('getSummary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/transactions/sync ───────────────────────────────
// Accepts an array of offline transactions recorded while the device
// was disconnected. Each entry carries a client-generated UUID in
// `client_id` used for idempotency: if the transaction already exists
// (duplicate sync) we return the existing server record instead of
// inserting a duplicate.
async function syncTransactions(req, res) {
  const { transactions } = req.body;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.json({ results: [] });
  }

  const results = [];

  for (const txnPayload of transactions) {
    const { client_id, items, payment_method = 'cash', discount_amount = 0,
            created_at } = txnPayload;

    if (!client_id) {
      results.push({ client_id: null, status: 'failed', error: 'client_id is required' });
      continue;
    }

    // ── Idempotency check ───────────────────────────────────
    try {
      const { rows: existing } = await db.query(
        `SELECT id, transaction_number FROM transactions WHERE client_id = $1`,
        [client_id]
      );
      if (existing.length > 0) {
        results.push({ client_id, status: 'duplicate', server_id: existing[0].id,
                       transaction_number: existing[0].transaction_number });
        continue;
      }
    } catch (err) {
      // client_id column might not exist yet (pre-migration) – treat as new
      console.warn('client_id column missing, running without idempotency check:', err.message);
    }

    if (!Array.isArray(items) || items.length === 0) {
      results.push({ client_id, status: 'failed', error: 'items array is required' });
      continue;
    }

    // ── Create transaction (same logic as createTransaction) ─
    const pgClient = await db.getClient();
    try {
      await pgClient.query('BEGIN');

      let subtotalSum = 0;
      let taxSum      = 0;
      const enrichedItems = [];
      let itemError = null;

      for (const item of items) {
        const { rows } = await pgClient.query(
          `SELECT id, name, price, tax_rate, has_inventory, stock_quantity,
                  COALESCE(unit_type, 'unit') AS unit_type
             FROM products WHERE id = $1 AND shop_id = $2`,
          [item.product_id, req.shopId]
        );
        if (rows.length === 0) { itemError = `Product ${item.product_id} not found`; break; }

        const product  = rows[0];
        const qty      = parseFloat(item.quantity)   || 1;
        const price    = parseFloat(item.unit_price) ?? parseFloat(product.price);
        const disc     = parseFloat(item.discount)   || 0;
        const subtotal = (price * qty) - disc;
        const taxAmt   = subtotal * (parseFloat(product.tax_rate) / 100);

        subtotalSum += subtotal;
        taxSum      += taxAmt;

        if (product.has_inventory) {
          const available = parseFloat(product.stock_quantity);
          if (available < qty) {
            const unit = product.unit_type === 'kg' ? 'KG' : 'units';
            itemError = `Insufficient stock for "${product.name}". Available: ${available} ${unit}`;
            break;
          }
          await pgClient.query(
            `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
            [qty, product.id]
          );
        }
        enrichedItems.push({ product_id: product.id, quantity: qty,
                             unit_price: price, discount: disc, subtotal });
      }

      if (itemError) {
        await pgClient.query('ROLLBACK');
        results.push({ client_id, status: 'failed', error: itemError });
        continue;
      }

      const totalAmount = subtotalSum + taxSum - parseFloat(discount_amount);
      const txnDate     = created_at ? new Date(created_at) : new Date();
      const txnNumber   = generateTxnNumber(req.shopId);

      // Try to include client_id; ignore if column doesn't exist yet
      let txnRows;
      try {
        ({ rows: txnRows } = await pgClient.query(
          `INSERT INTO transactions
             (shop_id, user_id, transaction_number, total_amount, tax_amount,
              discount_amount, payment_method, status, transaction_date, client_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9)
           RETURNING *`,
          [req.shopId, req.user.id, txnNumber, totalAmount, taxSum,
           discount_amount, payment_method, txnDate, client_id]
        ));
      } catch {
        // Fallback without client_id column (pre-migration)
        ({ rows: txnRows } = await pgClient.query(
          `INSERT INTO transactions
             (shop_id, user_id, transaction_number, total_amount, tax_amount,
              discount_amount, payment_method, status, transaction_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8)
           RETURNING *`,
          [req.shopId, req.user.id, txnNumber, totalAmount, taxSum,
           discount_amount, payment_method, txnDate]
        ));
      }

      const txn = txnRows[0];

      for (const item of enrichedItems) {
        await pgClient.query(
          `INSERT INTO transaction_items
             (transaction_id, product_id, quantity, unit_price, discount, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [txn.id, item.product_id, item.quantity, item.unit_price,
           item.discount, item.subtotal]
        );
      }

      await pgClient.query('COMMIT');
      results.push({ client_id, status: 'synced', server_id: txn.id,
                     transaction_number: txn.transaction_number });
    } catch (err) {
      await pgClient.query('ROLLBACK');
      console.error('sync transaction error:', err);
      results.push({ client_id, status: 'failed', error: 'Server error' });
    } finally {
      pgClient.release();
    }
  }

  res.json({ results, synced: results.filter((r) => r.status === 'synced').length });
}

module.exports = {
  createTransaction, listTransactions, getTransaction,
  voidTransaction, refundTransaction, getSummary, syncTransactions,
};
