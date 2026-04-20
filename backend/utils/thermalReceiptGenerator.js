/**
 * Thermal Receipt Generator
 * Produces plain-text receipts for 58mm (32 chars/line) and 80mm (48 chars/line) printers.
 *
 * Expected `data` shape:
 *   shopName, address, phone, email
 *   date, transactionNumber, cashier
 *   items: [{ name, quantity, unit_price, subtotal, unit_type, discount }]
 *   grossTotal, discount (order-level), netTotal
 *   paymentMethod, cashPaid  (cashPaid used to compute balance for cash payments)
 *   isVoid (optional)
 */

function generateThermalReceipt(data, options = {}) {
  const width = options.width === 32 ? 32 : 48; // 32 = 58mm, 48 = 80mm
  const sep   = '-'.repeat(width);
  const fmt   = (n) => Number(n || 0).toFixed(2);

  // ── Column config ─────────────────────────────────────────────
  const cfg = width === 32
    ? { indent: 3, qtyW: 7,  priceW: 11, amtW: 11, labelW: 20, valW: 12 }
    : { indent: 4, qtyW: 8,  priceW: 18, amtW: 18, labelW: 36, valW: 12 };
  // Sanity: indent+qtyW+priceW+amtW == width, labelW+valW == width

  // ── Helpers ───────────────────────────────────────────────────
  const centerLine = (text) => {
    const t = String(text || '');
    if (t.length >= width) return t.slice(0, width);
    const pad  = width - t.length;
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + t + ' '.repeat(pad - left);
  };

  const summaryRow = (label, value) =>
    String(label).padEnd(cfg.labelW) + fmt(value).padStart(cfg.valW);

  const wrapText = (text, maxW) => {
    if (text.length <= maxW) return [text];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const w = word.slice(0, maxW); // truncate single word if it exceeds maxW
      if (!cur) {
        cur = w;
      } else if (cur.length + 1 + w.length <= maxW) {
        cur += ' ' + w;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [text.slice(0, maxW)];
  };

  const lines = [];

  // ── HEADER ────────────────────────────────────────────────────
  // BOLD marker: lines tagged ##BOLD## are styled bold in the HTML wrapper
  lines.push('##BOLD##' + centerLine((data.shopName || 'SHOP').toUpperCase()));
  if (data.address) lines.push(centerLine(data.address));
  if (data.phone)   lines.push(centerLine(`Tel: ${data.phone}`));
  if (data.email)   lines.push(centerLine(data.email));
  lines.push(sep);

  // ── VOID STAMP ───────────────────────────────────────────────
  if (data.isVoid) {
    lines.push(centerLine('** VOID TRANSACTION **'));
    lines.push(sep);
  }

  // ── TRANSACTION INFO ─────────────────────────────────────────
  lines.push(`Date:    ${data.date || ''}`);
  lines.push(`Txn:     ${data.transactionNumber || ''}`);
  lines.push(`Cashier: ${data.cashier || ''}`);
  lines.push(sep);

  // ── ITEMS ─────────────────────────────────────────────────────
  (data.items || []).forEach((item, idx) => {
    const no      = String(idx + 1);
    const name    = String(item.name || 'Item');
    const maxName = width - no.length - 2; // "N  " prefix

    // Row 1: number + name (wraps if long)
    const nameWrapped = wrapText(name, maxName);
    lines.push(`${no}  ${nameWrapped[0]}`);
    for (let i = 1; i < nameWrapped.length; i++) {
      lines.push(' '.repeat(no.length + 2) + nameWrapped[i]);
    }

    // Row 2: indent + Qty | Price | Amount
    const qty    = item.unit_type === 'kg' ? `${item.quantity}kg` : String(item.quantity);
    const price  = fmt(item.unit_price);
    const amount = fmt(item.subtotal);

    lines.push(
      ' '.repeat(cfg.indent) +
      qty.padEnd(cfg.qtyW) +
      price.padStart(cfg.priceW) +
      amount.padStart(cfg.amtW)
    );

    // Show per-item discount if present
    if (Number(item.discount) > 0) {
      const discLabel = 'Disc:';
      const discVal   = `-${fmt(item.discount)}`;
      lines.push(' '.repeat(cfg.indent + cfg.qtyW) + (discLabel + ' ' + discVal).padStart(cfg.priceW + cfg.amtW));
    }
  });

  lines.push(sep);

  // ── TOTALS ────────────────────────────────────────────────────
  const grossTotal = Number(data.grossTotal ?? data.subtotal ?? 0);
  const discount   = Number(data.discount   ?? 0);
  const netTotal   = Number(data.netTotal   ?? data.total   ?? 0);

  lines.push(summaryRow('Gross Total', grossTotal));
  if (discount > 0) lines.push(summaryRow('Discount', discount));
  if (Number(data.tax ?? 0) > 0) lines.push(summaryRow('Tax', data.tax));
  lines.push('##BOLD##' + summaryRow('Net Total', netTotal));
  lines.push(sep);

  // ── PAYMENT ───────────────────────────────────────────────────
  const cashPaid = Number(data.cashPaid ?? 0);
  const method   = String(data.paymentMethod || 'cash');

  if (method === 'cash' && cashPaid > 0) {
    lines.push(summaryRow('Cash', cashPaid));
    const change = cashPaid - netTotal;
    if (change >= 0) lines.push(summaryRow('Balance', change));
  } else {
    lines.push(`Payment: ${capitalize(method)}`);
  }

  lines.push(sep);

  // ── FOOTER ────────────────────────────────────────────────────
  lines.push('');
  lines.push(centerLine('[ QR CODE HERE ]'));
  lines.push('');
  lines.push(sep);
  lines.push(centerLine('Thank you for your purchase!'));
  lines.push('');
  lines.push(centerLine('Powered by BillFlow'));
  lines.push(centerLine('0706421998'));
  lines.push('');

  return lines;
}

/** Converts the lines array to a plain string (strips ##BOLD## markers). */
function toPlainText(lines) {
  return lines.map((l) => l.replace(/^##BOLD##/, '')).join('\n');
}

/**
 * Wraps the receipt lines in a minimal print-ready HTML page.
 * Lines tagged ##BOLD## are rendered in bold.
 */
function toHtml(lines, options = {}) {
  const width    = options.width === 32 ? 32 : 48;
  const mmWidth  = width === 32 ? '58mm' : '80mm';
  const fontSize = width === 32 ? '11px' : '12px';

  const htmlLines = lines.map((line) => {
    const isBold  = line.startsWith('##BOLD##');
    const content = escHtml(line.replace(/^##BOLD##/, ''));
    return isBold ? `<b>${content}</b>` : content;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Receipt</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontSize};
    width: ${mmWidth};
    margin: 0 auto;
    padding: 4mm 3mm;
    color: #000;
  }
  pre {
    white-space: pre;
    font-family: inherit;
    font-size: inherit;
    line-height: 1.4;
    overflow: hidden;
  }
  .no-print { text-align:center; margin-bottom:4mm; }
  @media print {
    .no-print { display:none; }
    body { padding:0; margin:0; }
  }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 18px;cursor:pointer;font-size:13px;">&#128438; Print</button>
</div>
<pre>${htmlLines}</pre>
<script>
  var size = localStorage.getItem('pos_receipt_size');
  if (size === '58mm') { document.body.style.width='58mm'; document.body.style.fontSize='11px'; }
  if (size === '80mm') { document.body.style.width='80mm'; document.body.style.fontSize='12px'; }
  if (localStorage.getItem('pos_auto_print') === 'true') window.print();
</script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

module.exports = { generateThermalReceipt, toPlainText, toHtml };
