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

// ── GET /api/clothing/exchanges/:id/receipt ──────────────────
async function getExchangeReceipt(req, res) {
  try {
    const { rows: excRows } = await db.query(
      `SELECT ce.*,
              u.username AS cashier,
              s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
         FROM clothing_exchanges ce
         LEFT JOIN users u ON u.id = ce.user_id
         LEFT JOIN shops s ON s.id = ce.shop_id
        WHERE ce.id = $1 AND ce.shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (!excRows.length) return res.status(404).json({ error: 'Exchange not found' });

    const { rows: items } = await db.query(
      `SELECT cei.*, cv.size, cv.color, cp.name AS product_name
         FROM clothing_exchange_items cei
         JOIN clothing_variants cv ON cv.id = cei.variant_id
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cei.exchange_id = $1
        ORDER BY cei.direction DESC, cei.id`,
      [req.params.id]
    );

    const ex = excRows[0];
    const returned = items.filter(i => i.direction === 'returned');
    const issued   = items.filter(i => i.direction === 'issued');
    const net      = parseFloat(ex.net_refund_amount);
    const fmt      = n => Number(n || 0).toFixed(2);
    const esc      = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const QRCode = require('qrcode');
    let qrBlock = '';
    // QR code for net payment amount (customer pays extra)
    if (net < 0) {
      const payAmt = Math.abs(net).toFixed(2);
      try {
        const qrData  = `EXCHANGE-PAYMENT:${ex.exchange_number}:${payAmt}`;
        const qrUrl   = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });
        qrBlock = `
<div class="divider"></div>
<div style="text-align:center; margin:3mm 0 2mm;">
  <img src="${qrUrl}" width="90" height="90" alt="Payment QR" style="display:block; margin:0 auto 1.5mm;" />
  <p style="font-size:0.85em; font-weight:bold; color:#c00;">Amount Due: Rs. ${payAmt}</p>
  <p style="font-size:0.75em; color:#555;">Scan to pay the difference</p>
</div>`;
      } catch { /* skip if QR fails */ }
    }

    const makeRows = (list) => list.map(i => `
      <tr>
        <td class="name">${esc(i.product_name)} (${esc(i.size)} / ${esc(i.color)})</td>
        <td class="qty">${i.quantity}</td>
        <td class="price">${fmt(i.unit_price)}</td>
        <td class="total">${fmt(i.subtotal)}</td>
      </tr>`).join('');

    const returnTotal = returned.reduce((s, i) => s + parseFloat(i.subtotal), 0);
    const issueTotal  = issued.reduce((s, i)   => s + parseFloat(i.subtotal), 0);

    const fallbackDate = new Date(ex.created_at);
    const dateStr = fallbackDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr = fallbackDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Exchange ${esc(ex.exchange_number)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:12px; color:#000;
         width:80mm; margin:0 auto; padding:4mm 3mm; }
  .center { text-align:center; }
  .bold   { font-weight:bold; }
  .divider{ border-top:1px dashed #000; margin:3mm 0; }
  .shop-name { font-size:1.3em; font-weight:bold; text-align:center; }
  .shop-meta { text-align:center; font-size:0.9em; margin-bottom:1mm; }
  table { width:100%; border-collapse:collapse; }
  th { border-bottom:1px solid #000; text-align:left; padding-bottom:1mm; }
  td { padding:0.5mm 0; vertical-align:top; }
  td.qty, th.qty, td.price, th.price, td.total, th.total { text-align:right; white-space:nowrap; }
  td.name { max-width:32mm; word-break:break-word; }
  td.price { width:16mm; } td.qty { width:8mm; } td.total { width:16mm; }
  .section-head { font-weight:bold; font-size:0.9em; padding:1.5mm 0 0.5mm;
                  border-bottom:1px solid #000; margin-top:2mm; }
  .section-return { color:#c00; }
  .section-issue  { color:#060; }
  .summary-row td { padding-top:1mm; }
  .net-row td { font-weight:bold; font-size:1.1em; border-top:1px solid #000; padding-top:1.5mm; }
  .stamp { text-align:center; border:2px solid #555; color:#555; font-weight:bold;
           font-size:1.3em; padding:2mm; margin:3mm 0; letter-spacing:2px; }
  .thank-you { text-align:center; margin-top:4mm; font-size:0.9em; }
  @media print { body { margin:0; } .no-print { display:none; } }
</style>
</head>
<body id="receipt-body">

<div class="no-print" style="margin-bottom:4mm; display:flex; justify-content:center;">
  <button onclick="window.print()" style="padding:6px 18px; cursor:pointer; font-size:13px;">🖨 Print</button>
</div>

<p class="shop-name">${esc(ex.shop_name || 'Shop')}</p>
${ex.shop_address ? `<p class="shop-meta">${esc(ex.shop_address)}</p>` : ''}
${ex.shop_phone   ? `<p class="shop-meta">Tel: ${esc(ex.shop_phone)}</p>` : ''}

<div class="divider"></div>
<div class="stamp">★ EXCHANGE ★</div>
<div class="divider"></div>

<p>Date: <strong><span id="exc-date">${dateStr}&nbsp;&nbsp;${timeStr}</span></strong></p>
<p>Ref: <strong>${esc(ex.exchange_number)}</strong></p>
<p>Orig Txn: <strong>${esc(ex.original_transaction_id)}</strong></p>
<p>Cashier: ${esc(ex.cashier || '—')}</p>
${ex.customer_phone ? `<p>Customer: ${esc(ex.customer_phone)}</p>` : ''}

${returned.length ? `
<div class="divider"></div>
<p class="section-head section-return">RETURNED ITEMS</p>
<table>
  <thead><tr>
    <th class="name">Item</th>
    <th class="qty">Qty</th>
    <th class="price">Price</th>
    <th class="total">Total</th>
  </tr></thead>
  <tbody>${makeRows(returned)}</tbody>
  <tfoot>
    <tr class="summary-row"><td colspan="3" style="color:#c00;">Return Credit</td>
      <td style="color:#c00;">+${fmt(returnTotal)}</td></tr>
  </tfoot>
</table>` : ''}

${issued.length ? `
<div class="divider"></div>
<p class="section-head section-issue">NEW ITEMS ISSUED</p>
<table>
  <thead><tr>
    <th class="name">Item</th>
    <th class="qty">Qty</th>
    <th class="price">Price</th>
    <th class="total">Total</th>
  </tr></thead>
  <tbody>${makeRows(issued)}</tbody>
  <tfoot>
    <tr class="summary-row"><td colspan="3" style="color:#060;">Items Total</td>
      <td style="color:#060;">-${fmt(issueTotal)}</td></tr>
  </tfoot>
</table>` : ''}

<div class="divider"></div>
<table>
  <tfoot>
    <tr class="net-row">
      <td colspan="3">${net >= 0 ? 'REFUND TO CUSTOMER' : 'AMOUNT DUE'}</td>
      <td>${net >= 0 ? `Rs. ${fmt(net)}` : `Rs. ${fmt(Math.abs(net))}`}</td>
    </tr>
  </tfoot>
</table>

${qrBlock}
<div class="divider"></div>
${net >= 0
  ? `<p class="thank-you bold">Refund: Rs. ${fmt(net)} — Please pay the customer</p>`
  : `<p class="thank-you bold" style="color:#c00;">Customer pays Rs. ${fmt(Math.abs(net))}</p>`}
<p class="thank-you">Thank you!</p>
<p class="thank-you" style="font-size:0.75em; margin-top:1mm; color:#777;">Powered by BillFlow</p>

<script>
  try {
    var d = new Date('${ex.created_at}');
    document.getElementById('exc-date').textContent =
      d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      + '   ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  } catch(e) {}
  if (localStorage.getItem('pos_auto_print') === 'true') window.print();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('getExchangeReceipt error:', err);
    res.status(500).json({ error: 'Server error generating receipt' });
  }
}

module.exports = { lookupTransaction, processExchange, listExchanges, getExchange, getExchangeReceipt };
