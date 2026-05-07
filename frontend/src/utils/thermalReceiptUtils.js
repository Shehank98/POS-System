/**
 * Thermal Receipt Utilities (browser-side)
 * Mirrors the backend thermalReceiptGenerator logic for in-browser preview and printing.
 *
 * generateThermalLines(data, options) → string[]
 *   options.width: 32 (58mm) | 48 (80mm, default)
 *
 * linesToText(lines)  → plain string
 * linesToHtml(lines)  → HTML string for <pre> rendering
 */

export function generateThermalLines(data, options = {}) {
  const width = options.width === 32 ? 32 : 48;
  const sep   = '-'.repeat(width);
  const fmt   = (n) => Number(n || 0).toFixed(2);

  const cfg = width === 32
    ? { indent: 3, qtyW: 7,  priceW: 11, amtW: 11, labelW: 20, valW: 12 }
    : { indent: 4, qtyW: 8,  priceW: 18, amtW: 18, labelW: 36, valW: 12 };

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
    const result = [];
    let cur = '';
    for (const word of words) {
      const w = word.slice(0, maxW);
      if (!cur) {
        cur = w;
      } else if (cur.length + 1 + w.length <= maxW) {
        cur += ' ' + w;
      } else {
        result.push(cur);
        cur = w;
      }
    }
    if (cur) result.push(cur);
    return result.length ? result : [text.slice(0, maxW)];
  };

  const lines = [];

  // ── HEADER ────────────────────────────────────────────────────
  lines.push('##BOLD##' + centerLine((data.shopName || 'SHOP').toUpperCase()));
  if (data.address) lines.push(centerLine(data.address));
  if (data.phone)   lines.push(centerLine(`Tel: ${data.phone}`));
  if (data.email)   lines.push(centerLine(data.email));
  lines.push(sep);

  if (data.isVoid) {
    lines.push(centerLine('** VOID TRANSACTION **'));
    lines.push(sep);
  }

  // ── TRANSACTION INFO ──────────────────────────────────────────
  lines.push(`Date:    ${data.date || ''}`);
  lines.push(`Txn:     ${data.transactionNumber || ''}`);
  lines.push(`Cashier: ${data.cashier || ''}`);
  lines.push(sep);

  // ── ITEMS ──────────────────────────────────────────────────────
  (data.items || []).forEach((item, idx) => {
    const no      = String(idx + 1);
    const name    = String(item.name || 'Item');
    const maxName = width - no.length - 2;

    const nameWrapped = wrapText(name, maxName);
    lines.push(`${no}  ${nameWrapped[0]}`);
    for (let i = 1; i < nameWrapped.length; i++) {
      lines.push(' '.repeat(no.length + 2) + nameWrapped[i]);
    }

    const qty    = item.unit_type === 'kg' ? `${item.quantity}kg` : String(item.quantity);
    const price  = fmt(item.unit_price);
    const amount = fmt(item.subtotal);

    lines.push(
      ' '.repeat(cfg.indent) +
      qty.padEnd(cfg.qtyW) +
      price.padStart(cfg.priceW) +
      amount.padStart(cfg.amtW)
    );

    if (Number(item.discount) > 0) {
      const disc = `Disc: -${fmt(item.discount)}`;
      lines.push(' '.repeat(cfg.indent + cfg.qtyW) + disc.padStart(cfg.priceW + cfg.amtW));
    }
  });

  lines.push(sep);

  // ── TOTALS ─────────────────────────────────────────────────────
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
  // ##QR## marks the line where ThermalReceiptPreview injects a real QR component
  lines.push('##QR##' + centerLine('[ QR CODE HERE ]'));
  lines.push('');
  lines.push(sep);
  lines.push(centerLine('Thank you for your purchase!'));
  lines.push('');
  lines.push(centerLine('Powered by BillFlow'));
  lines.push(centerLine('0706421998'));
  lines.push('');

  return lines;
}

/** Strip all ## markers and join to plain text. */
export function linesToText(lines) {
  return lines.map((l) => l.replace(/^##\w+##/, '')).join('\n');
}

/**
 * Convert lines array to HTML for rendering in a <pre>.
 * ##QR## lines are skipped here - ThermalReceiptPreview handles them separately.
 */
export function linesToHtml(lines) {
  return lines
    .filter((l) => !l.startsWith('##QR##'))
    .map((l) => {
      const bold    = l.startsWith('##BOLD##');
      const content = l.replace(/^##BOLD##/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return bold ? `<b>${content}</b>` : content;
    })
    .join('\n');
}

function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}
