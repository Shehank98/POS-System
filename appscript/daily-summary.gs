// ============================================================
//  BillFlow — Daily Sales Summary Mailer
//  Google Apps Script  ·  GmailApp sender
//
//  SETUP:
//  1. Open https://script.google.com → New project
//  2. Paste this entire file into the editor
//  3. Fill in CONFIG below (API URL + key)
//  4. Run sendDailySummary() once manually to test
//  5. Triggers → Add trigger:
//       Function:    sendDailySummary
//       Event:       Time-driven → Day timer → 10 PM – 11 PM
// ============================================================

var CONFIG = {
  // Your deployed backend URL (no trailing slash)
  apiUrl: 'https://your-backend.railway.app',

  // Matches DAILY_SUMMARY_KEY in your .env
  apiKey: 'replace_with_your_daily_summary_key',

  // BillFlow logo — replace with your actual hosted image URL
  logoUrl: 'https://your-domain.com/billflow-logo.png',

  // BillFlow contact shown in email footer
  phone: '0706421998',
  website: 'BillFlow',
};

// ── Entry point (called by the 10 PM trigger) ────────────────
function sendDailySummary() {
  var url     = CONFIG.apiUrl + '/api/email-summary/daily';
  var options = {
    method:  'get',
    headers: { 'Authorization': 'Bearer ' + CONFIG.apiKey },
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() !== 200) {
    Logger.log('API error: ' + response.getContentText());
    return;
  }

  var data      = JSON.parse(response.getContentText());
  var shops     = data.shops || [];
  var sentAt    = new Date();
  var dateLabel = formatDateLabel(sentAt);  // e.g. "Wednesday, 16 Apr 2026"

  var sent = 0;
  shops.forEach(function(shop) {
    if (!shop.email) return;

    // Skip shops with zero transactions (no email needed)
    if (shop.transaction_count === 0) return;

    var subject  = 'Daily Sales Report – ' + shop.shop_name + ' (' + formatShortDate(sentAt) + ')';
    var htmlBody = buildEmailHtml(shop, dateLabel);

    GmailApp.sendEmail(shop.email, subject, '', { htmlBody: htmlBody, name: 'BillFlow' });
    Logger.log('Sent to: ' + shop.email + ' (' + shop.shop_name + ')');
    sent++;
  });

  Logger.log('Done. Sent ' + sent + ' email(s).');
}

// ── Build HTML email ─────────────────────────────────────────
function buildEmailHtml(shop, dateLabel) {
  var totalSales = parseFloat(shop.total_sales);
  var cashSales  = parseFloat(shop.cash_sales);
  var cardSales  = parseFloat(shop.card_sales);
  var mobSales   = parseFloat(shop.mobile_sales);
  var hasSales   = totalSales > 0;

  // Payment bar widths (percentage of total)
  function barPct(val) {
    if (!hasSales || totalSales === 0) return 0;
    return Math.round((parseFloat(val) / totalSales) * 100);
  }

  var cashPct = barPct(cashSales);
  var cardPct = barPct(cardSales);
  var mobPct  = barPct(mobSales);

  // Top products rows
  var productRows = '';
  if (shop.top_products && shop.top_products.length > 0) {
    shop.top_products.forEach(function(p, i) {
      var qty = (p.qty_sold % 1 === 0) ? p.qty_sold : parseFloat(p.qty_sold).toFixed(3);
      productRows +=
        '<tr style="border-bottom:1px solid #f3f4f6;">' +
          '<td style="padding:10px 12px;color:#374151;font-size:13px;">' +
            '<span style="color:#9ca3af;margin-right:8px;">' + (i + 1) + '</span>' +
            escHtml(p.name) +
          '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;font-size:13px;">' + qty + ' sold</td>' +
          '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#111827;font-size:13px;">Rs. ' + p.revenue + '</td>' +
        '</tr>';
    });
  } else {
    productRows =
      '<tr><td colspan="3" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">' +
        'No product data available' +
      '</td></tr>';
  }

  // Payment bar helper
  function paymentRow(label, amount, pct, color) {
    if (parseFloat(amount) === 0) return '';
    return (
      '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
          '<span style="font-size:13px;color:#374151;">' + label + '</span>' +
          '<span style="font-size:13px;font-weight:600;color:#111827;">Rs. ' + fmtNum(amount) + '</span>' +
        '</div>' +
        '<div style="height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;">' +
          '<div style="height:8px;width:' + pct + '%;background:' + color + ';border-radius:4px;"></div>' +
        '</div>' +
      '</div>'
    );
  }

  var html = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">' +

    // Outer wrapper
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;">' +
    '<tr><td align="center" style="padding:32px 16px;">' +

    // Card
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">' +

    // ── Header ────────────────────────────────────────────────
    '<tr><td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:28px 32px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td>' +
          (CONFIG.logoUrl
            ? '<img src="' + CONFIG.logoUrl + '" alt="BillFlow" height="36" style="display:block;margin-bottom:12px;" />'
            : '<div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:12px;">BillFlow</div>') +
          '<div style="font-size:22px;font-weight:700;color:#ffffff;">' + escHtml(shop.shop_name) + '</div>' +
          '<div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Daily Sales Report</div>' +
        '</td>' +
        '<td align="right" valign="top">' +
          '<div style="text-align:right;">' +
            '<div style="font-size:12px;color:#93c5fd;">' + dateLabel + '</div>' +
            '<div style="font-size:12px;color:#93c5fd;margin-top:2px;">Sent at 10:00 PM</div>' +
          '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // ── Today's Overview ──────────────────────────────────────
    '<tr><td style="padding:28px 32px 0;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;margin-bottom:16px;">Today\'s Overview</div>' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
      '<tr>' +
        statBox('Total Sales',   'Rs. ' + fmtNum(shop.total_sales), '#2563eb', hasSales) +
        statBox('Transactions',  String(shop.transaction_count),     '#059669', hasSales) +
      '</tr>' +
      '<tr style="height:12px;"></tr>' +
      '<tr>' +
        statBox('Tax Collected',  'Rs. ' + fmtNum(shop.total_tax),      '#d97706', false) +
        statBox('Discounts Given','Rs. ' + fmtNum(shop.total_discounts), '#7c3aed', false) +
      '</tr>' +
      '</table>' +
    '</td></tr>' +

    // ── Payment Breakdown ─────────────────────────────────────
    '<tr><td style="padding:24px 32px 0;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;margin-bottom:16px;">Payment Breakdown</div>' +
      paymentRow('Cash',   shop.cash_sales,   cashPct, '#10b981') +
      paymentRow('Card',   shop.card_sales,   cardPct, '#3b82f6') +
      paymentRow('Mobile', shop.mobile_sales, mobPct,  '#8b5cf6') +
      (!hasSales ? '<p style="color:#9ca3af;font-size:13px;margin:0;">No payments recorded today.</p>' : '') +
    '</td></tr>' +

    // ── Top Products ──────────────────────────────────────────
    '<tr><td style="padding:24px 32px 0;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">Top Products Today</div>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;">' +
        '<thead>' +
          '<tr style="background:#f9fafb;">' +
            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>' +
            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>' +
            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Revenue</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + productRows + '</tbody>' +
      '</table>' +
    '</td></tr>' +

    // ── Net Sales callout ─────────────────────────────────────
    (parseFloat(shop.total_refunds) > 0
      ? '<tr><td style="padding:20px 32px 0;">' +
          '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;">' +
            '<strong>Net Sales: Rs. ' + fmtNum(shop.net_sales) + '</strong> &nbsp;(after Rs. ' + fmtNum(shop.total_refunds) + ' in refunds)' +
          '</div>' +
        '</td></tr>'
      : '') +

    // ── Footer ────────────────────────────────────────────────
    '<tr><td style="padding:28px 32px;">' +
      '<div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center;">' +
        '<div style="font-size:12px;color:#9ca3af;">Powered by <strong style="color:#2563eb;">' + CONFIG.website + '</strong></div>' +
        '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">' + CONFIG.phone + '</div>' +
        '<div style="font-size:11px;color:#d1d5db;margin-top:8px;">This is an automated daily report. Do not reply to this email.</div>' +
      '</div>' +
    '</td></tr>' +

    '</table>' +  // end card
    '</td></tr></table>' +  // end outer
    '</body></html>'
  );

  return html;
}

// ── Stat box helper ───────────────────────────────────────────
function statBox(label, value, color, bold) {
  return (
    '<td style="width:50%;padding-right:8px;" valign="top">' +
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">' +
        '<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">' + label + '</div>' +
        '<div style="font-size:' + (bold ? '22px' : '18px') + ';font-weight:700;color:' + (bold ? color : '#111827') + ';">' + value + '</div>' +
      '</div>' +
    '</td>'
  );
}

// ── Helpers ───────────────────────────────────────────────────
function fmtNum(val) {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateLabel(d) {
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function formatShortDate(d) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
