const db      = require('../config/database');
const QRCode  = require('qrcode');

// ── GET /api/transactions/:id/receipt ────────────────────────
async function getReceipt(req, res) {
  try {
    // Fetch transaction — only columns that exist in the base schema
    const { rows: txnRows } = await db.query(
      `SELECT t.*, u.username AS cashier,
              s.name AS shop_name, s.address AS shop_address,
              s.phone AS shop_phone, s.email AS shop_email
         FROM transactions t
         LEFT JOIN users  u ON u.id  = t.user_id
         LEFT JOIN shops  s ON s.id  = t.shop_id
        WHERE t.id = $1 AND t.shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (txnRows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    // Fetch optional columns added by migration 005 (logo_url, contact_email).
    // Wrapped in try/catch so receipt still works if migration hasn't been run yet.
    let shopLogo = '';
    let shopContactEmail = txnRows[0].shop_email || '';
    try {
      const { rows: extra } = await db.query(
        `SELECT COALESCE(logo_url, '') AS logo_url,
                COALESCE(contact_email, email) AS contact_email
           FROM shops WHERE id = $1`,
        [txnRows[0].shop_id]
      );
      if (extra.length > 0) {
        shopLogo         = extra[0].logo_url         || '';
        shopContactEmail = extra[0].contact_email    || shopContactEmail;
      }
    } catch { /* migration 005 not yet applied — continue without logo/contact email */ }

    // Fetch line items (include unit_type for weight display; graceful fallback)
    let items;
    try {
      const { rows } = await db.query(
        `SELECT ti.*,
                COALESCE(p.name,      'Deleted product') AS product_name,
                COALESCE(p.unit_type, 'unit')            AS unit_type
           FROM transaction_items ti
           LEFT JOIN products p ON p.id = ti.product_id
          WHERE ti.transaction_id = $1`,
        [req.params.id]
      );
      items = rows;
    } catch {
      // unit_type column not yet added (pre-migration 010)
      const { rows } = await db.query(
        `SELECT ti.*, COALESCE(p.name, 'Deleted product') AS product_name, 'unit' AS unit_type
           FROM transaction_items ti
           LEFT JOIN products p ON p.id = ti.product_id
          WHERE ti.transaction_id = $1`,
        [req.params.id]
      );
      items = rows;
    }

    const t = txnRows[0];
    const fmt = (n) => Number(n || 0).toFixed(2);

    // Generate QR code pointing to the pre-order page for this shop
    let qrBlock = '';
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const orderUrl = `${frontendUrl}/order?shop_id=${t.shop_id}`;
      const qrDataUrl = await QRCode.toDataURL(orderUrl, { width: 120, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
      qrBlock = `
<div class="divider"></div>
<div style="text-align:center; margin:3mm 0 2mm;">
  <img src="${qrDataUrl}" width="90" height="90" alt="Pre-order QR" style="display:block; margin:0 auto 1.5mm;" />
  <p style="font-size:0.8em; color:#555;">Scan to pre-order next time</p>
</div>`;
    } catch { /* QR generation failed — receipt still works */ }

    // Server-side fallback date (will be overridden by client-side JS for correct timezone)
    const serverDate = new Date(t.transaction_date);
    const fallbackDateStr = serverDate.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const fallbackTimeStr = serverDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const itemRows = items.map((i) => {
      const qtyDisplay = i.unit_type === 'kg' ? fmtWeight(parseFloat(i.quantity)) : Number(i.quantity);
      const priceLabel = i.unit_type === 'kg' ? `${fmt(i.unit_price)}/kg` : fmt(i.unit_price);
      return `
      <tr>
        <td class="name">${escHtml(i.product_name)}</td>
        <td class="qty">${qtyDisplay}</td>
        <td class="price">${priceLabel}</td>
        ${Number(i.discount) > 0 ? `<td class="disc">-${fmt(i.discount)}</td>` : '<td class="disc"></td>'}
        <td class="total">${fmt(i.subtotal)}</td>
      </tr>`;
    }).join('');

    const discountRow = Number(t.discount_amount) > 0
      ? `<tr class="summary-row"><td colspan="4">Discount</td><td>-${fmt(t.discount_amount)}</td></tr>` : '';
    const taxRow = Number(t.tax_amount) > 0
      ? `<tr class="summary-row"><td colspan="4">Tax</td><td>${fmt(t.tax_amount)}</td></tr>` : '';

    // Logo block
    const logoBlock = shopLogo
      ? `<div class="logo-wrap"><img src="${escHtml(shopLogo)}" alt="logo" class="shop-logo" /></div>`
      : '';

    // Contact block
    const contactLines = [
      t.shop_address ? escHtml(t.shop_address) : null,
      t.shop_phone   ? `Tel: ${escHtml(t.shop_phone)}` : null,
      shopContactEmail ? escHtml(shopContactEmail) : null,
    ].filter(Boolean);
    const contactBlock = contactLines.map((l) => `<p class="shop-meta">${l}</p>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Receipt #${escHtml(t.transaction_number)}</title>
<style>
  /* ── Reset ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Thermal mode (default): 80mm width ── */
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    width: 80mm;
    margin: 0 auto;
    padding: 4mm 3mm;
  }

  /* ── A4 mode override via class ── */
  body.a4 {
    width: 210mm;
    padding: 15mm 20mm;
    font-size: 13px;
  }
  body.narrow { width: 58mm; font-size: 11px; }

  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 3mm 0; }

  .logo-wrap  { text-align: center; margin-bottom: 2mm; }
  .shop-logo  { max-height: 14mm; max-width: 100%; object-fit: contain; }

  .shop-name { font-size: 1.3em; font-weight: bold; text-align: center; }
  .shop-meta { text-align: center; font-size: 0.9em; margin-bottom: 1mm; }

  table { width: 100%; border-collapse: collapse; }
  th    { border-bottom: 1px solid #000; text-align: left; padding-bottom: 1mm; }
  td    { padding: 0.5mm 0; vertical-align: top; }
  td.qty, th.qty, td.price, th.price, td.total, th.total, td.disc, th.disc {
    text-align: right;
    white-space: nowrap;
  }
  td.name  { max-width: 30mm; word-break: break-word; }
  td.price { width: 16mm; }
  td.qty   { width: 8mm; }
  td.total { width: 16mm; }
  td.disc  { width: 14mm; font-size: 0.9em; color: #555; }

  .summary-row td { padding-top: 1mm; }
  .grand-total td  { font-weight: bold; font-size: 1.1em; border-top: 1px solid #000; padding-top: 1.5mm; }
  .payment-method  { margin-top: 2mm; }
  .thank-you       { text-align: center; margin-top: 4mm; font-size: 0.95em; }
  .voided-stamp    { text-align: center; color: #cc0000; font-weight: bold;
                     font-size: 1.4em; border: 2px solid #cc0000;
                     padding: 2mm; margin: 3mm 0; }

  @media print {
    body { margin: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body id="receipt-body">

<!-- Print control (hidden on print) -->
<div class="no-print" style="margin-bottom:4mm; display:flex; justify-content:center;">
  <button onclick="window.print()" style="padding:6px 18px; cursor:pointer; font-size:13px;">🖨 Print</button>
</div>

${logoBlock}
<p class="shop-name">${escHtml(t.shop_name || 'Shop')}</p>
${contactBlock}

<div class="divider"></div>

<p>Date: <strong><span id="txn-date">${fallbackDateStr}&nbsp;&nbsp;${fallbackTimeStr}</span></strong></p>
<p>Txn: <strong>${escHtml(t.transaction_number)}</strong></p>
<p>Cashier: ${escHtml(t.cashier || '—')}</p>

${t.status === 'void' ? '<div class="voided-stamp">★ VOID ★</div>' : ''}

<div class="divider"></div>

<table>
  <thead>
    <tr>
      <th class="name">Item</th>
      <th class="qty">Qty</th>
      <th class="price">Price</th>
      <th class="disc">Disc</th>
      <th class="total">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr class="summary-row"><td colspan="4">Subtotal</td><td>${fmt(Number(t.total_amount) + Number(t.discount_amount) - Number(t.tax_amount))}</td></tr>
    ${discountRow}
    ${taxRow}
    <tr class="grand-total"><td colspan="4">TOTAL</td><td>${fmt(t.total_amount)}</td></tr>
  </tfoot>
</table>

<p class="payment-method">Payment: <strong>${capitalize(t.payment_method)}</strong></p>

${qrBlock}
<div class="divider"></div>
<p class="thank-you">Thank you for your purchase!</p>
<p class="thank-you" style="font-size:0.8em; margin-top:1mm; color:#555;">
  Powered by BillFlow
</p>
<p class="thank-you" style="font-size:0.75em; margin-top:0.5mm; color:#777;">
  0706421998
</p>

<script>
  // Fix date/time to browser local timezone (server may be UTC)
  try {
    var d = new Date('${t.transaction_date}');
    var dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
    var timeOpts = { hour: '2-digit', minute: '2-digit' };
    document.getElementById('txn-date').textContent =
      d.toLocaleDateString('en-GB', dateOpts) + '   ' +
      d.toLocaleTimeString('en-GB', timeOpts);
  } catch(e) {}
  // Apply saved paper size
  var size = localStorage.getItem('pos_receipt_size');
  if (size) document.getElementById('receipt-body').className = size;
  // Auto-print if flag is set
  if (localStorage.getItem('pos_auto_print') === 'true') window.print();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('getReceipt error:', err);
    res.status(500).json({ error: 'Server error generating receipt' });
  }
}

function fmtWeight(kg) {
  const grams = kg * 1000;
  if (grams < 1000) return `${Math.round(grams)}g`;
  return `${parseFloat(kg.toFixed(3))}kg`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

module.exports = { getReceipt };
