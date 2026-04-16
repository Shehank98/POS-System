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
  apiUrl: 'https://pos-system-production-74ed.up.railway.app',

  // Matches DAILY_SUMMARY_KEY in your Railway environment variables
  apiKey: 'replace_with_your_daily_summary_key',

  // BillFlow logo (Google Drive direct image URL)
  logoUrl: 'https://drive.google.com/uc?export=view&id=1aV5lJE-QiWDsrSeKElmD0eLE72JJMliB',

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
  var dateLabel = formatDateLabel(sentAt);

  var sent = 0;
  shops.forEach(function(shop) {
    if (!shop.email) return;
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
  var totalSales    = parseFloat(shop.total_sales);
  var cashSales     = parseFloat(shop.cash_sales);
  var cardSales     = parseFloat(shop.card_sales);
  var mobSales      = parseFloat(shop.mobile_sales);
  var hasSales      = totalSales > 0;
  var txCount       = shop.transaction_count || 0;
  var voidedCount   = shop.voided_count || 0;
  var refundedCount = shop.refunded_count || 0;
  var itemsSold     = shop.total_items_sold || 0;

  // Payment bar widths (percentage of total)
  function barPct(val) {
    if (!hasSales) return 0;
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
      var rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      productRows +=
        '<tr style="background:' + rowBg + ';">' +
          '<td style="padding:10px 14px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">' +
            '<span style="display:inline-block;width:20px;height:20px;background:#e0e7ff;color:#3730a3;' +
                   'border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:8px;">' +
              (i + 1) +
            '</span>' +
            escHtml(p.name) +
          '</td>' +
          '<td style="padding:10px 14px;text-align:right;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">' + qty + '</td>' +
          '<td style="padding:10px 14px;text-align:right;font-weight:600;color:#111827;font-size:13px;border-bottom:1px solid #f3f4f6;">Rs. ' + p.revenue + '</td>' +
        '</tr>';
    });
  } else {
    productRows =
      '<tr><td colspan="3" style="padding:20px;text-align:center;color:#9ca3af;font-size:13px;">' +
        'No product data available' +
      '</td></tr>';
  }

  // Payment bar helper
  function paymentRow(label, amount, pct, color) {
    if (parseFloat(amount) === 0) return '';
    var pctLabel = pct + '%';
    return (
      '<tr>' +
        '<td style="padding:8px 0;width:80px;font-size:13px;color:#374151;">' + label + '</td>' +
        '<td style="padding:8px 0;">' +
          '<div style="height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;">' +
            '<div style="height:10px;width:' + pct + '%;background:' + color + ';border-radius:5px;"></div>' +
          '</div>' +
        '</td>' +
        '<td style="padding:8px 0 8px 12px;text-align:right;font-weight:600;color:#111827;font-size:13px;white-space:nowrap;width:110px;">' +
          'Rs. ' + fmtNum(amount) +
        '</td>' +
        '<td style="padding:8px 0 8px 8px;color:#9ca3af;font-size:12px;width:36px;">' + pctLabel + '</td>' +
      '</tr>'
    );
  }

  // ── Section header ────────────────────────────────────────
  function sectionHead(title) {
    return (
      '<tr><td style="padding:24px 32px 0;">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;' +
             'border-left:3px solid #2563eb;padding-left:10px;margin-bottom:14px;">' +
          title +
        '</div>' +
      '</td></tr>'
    );
  }

  var html = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">' +

    // Outer wrapper
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">' +
    '<tr><td align="center" style="padding:28px 16px;">' +

    // Card
    '<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;' +
         'border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">' +

    // ── Blue top stripe ───────────────────────────────────────
    '<tr><td style="background:linear-gradient(90deg,#1d4ed8,#0891b2);height:5px;font-size:0;">&nbsp;</td></tr>' +

    // ── White header with logo ────────────────────────────────
    '<tr><td style="background:#ffffff;padding:24px 32px 20px;border-bottom:1px solid #e5e7eb;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td valign="middle">' +
          (CONFIG.logoUrl
            ? '<img src="' + CONFIG.logoUrl + '" alt="BillFlow" height="44" style="display:block;" />'
            : '<div style="font-size:22px;font-weight:800;color:#1d4ed8;">BillFlow</div>') +
        '</td>' +
        '<td align="right" valign="middle">' +
          '<div style="text-align:right;">' +
            '<div style="font-size:13px;color:#374151;font-weight:600;">' + dateLabel + '</div>' +
            '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">Sent at 10:00 PM</div>' +
          '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // ── Shop name banner ──────────────────────────────────────
    '<tr><td style="background:#1e3a5f;padding:16px 32px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td>' +
          '<div style="font-size:18px;font-weight:700;color:#ffffff;">' + escHtml(shop.shop_name) + '</div>' +
          '<div style="font-size:12px;color:#93c5fd;margin-top:2px;">Daily Sales Summary</div>' +
        '</td>' +
        '<td align="right">' +
          '<div style="background:#2563eb;border-radius:20px;padding:5px 14px;display:inline-block;">' +
            '<span style="font-size:12px;font-weight:600;color:#ffffff;">' + txCount + ' transaction' + (txCount !== 1 ? 's' : '') + '</span>' +
          '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // ── Today's Overview ──────────────────────────────────────
    sectionHead("Today's Overview") +
    '<tr><td style="padding:0 32px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
      '<tr>' +
        statBox('Total Sales',      'Rs. ' + fmtNum(shop.total_sales), '#1d4ed8', true) +
        '<td style="width:12px;"></td>' +
        statBox('Net Sales',        'Rs. ' + fmtNum(shop.net_sales),   '#059669', hasSales) +
      '</tr>' +
      '<tr style="height:10px;"></tr>' +
      '<tr>' +
        statBox('Avg Transaction',  'Rs. ' + fmtNum(shop.avg_transaction), '#0891b2', false) +
        '<td style="width:12px;"></td>' +
        statBox('Items Sold',       String(itemsSold) + ' items',           '#7c3aed', false) +
      '</tr>' +
      '<tr style="height:10px;"></tr>' +
      '<tr>' +
        statBox('Tax Collected',    'Rs. ' + fmtNum(shop.total_tax),       '#d97706', false) +
        '<td style="width:12px;"></td>' +
        statBox('Discounts Given',  'Rs. ' + fmtNum(shop.total_discounts), '#dc2626', false) +
      '</tr>' +
      '</table>' +
    '</td></tr>' +

    // ── Voids / Refunds alert (only if > 0) ───────────────────
    (voidedCount > 0 || refundedCount > 0
      ? '<tr><td style="padding:14px 32px 0;">' +
          '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">' +
            '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
              '<td style="font-size:13px;color:#92400e;">' +
                (voidedCount > 0 ? '<strong>' + voidedCount + ' voided</strong>' : '') +
                (voidedCount > 0 && refundedCount > 0 ? ' &nbsp;·&nbsp; ' : '') +
                (refundedCount > 0 ? '<strong>' + refundedCount + ' refunded</strong> (Rs. ' + fmtNum(shop.total_refunds) + ')' : '') +
                ' &nbsp;today' +
              '</td>' +
              '<td align="right" style="font-size:13px;color:#92400e;">' +
                'Net after refunds: <strong>Rs. ' + fmtNum(shop.net_sales) + '</strong>' +
              '</td>' +
            '</tr></table>' +
          '</div>' +
        '</td></tr>'
      : '') +

    // ── Payment Breakdown ─────────────────────────────────────
    sectionHead('Payment Breakdown') +
    '<tr><td style="padding:0 32px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
        paymentRow('Cash',   shop.cash_sales,   cashPct, '#10b981') +
        paymentRow('Card',   shop.card_sales,   cardPct, '#3b82f6') +
        paymentRow('Mobile', shop.mobile_sales, mobPct,  '#8b5cf6') +
      '</table>' +
      (!hasSales ? '<p style="color:#9ca3af;font-size:13px;margin:0;">No payments recorded today.</p>' : '') +
    '</td></tr>' +

    // ── Top Products ──────────────────────────────────────────
    sectionHead('Top Products Today') +
    '<tr><td style="padding:0 32px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">' +
        '<thead>' +
          '<tr style="background:#1e3a5f;">' +
            '<th style="padding:10px 14px;text-align:left;font-size:11px;color:#93c5fd;font-weight:600;text-transform:uppercase;">Product</th>' +
            '<th style="padding:10px 14px;text-align:right;font-size:11px;color:#93c5fd;font-weight:600;text-transform:uppercase;">Qty Sold</th>' +
            '<th style="padding:10px 14px;text-align:right;font-size:11px;color:#93c5fd;font-weight:600;text-transform:uppercase;">Revenue</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + productRows + '</tbody>' +
      '</table>' +
    '</td></tr>' +

    // ── Footer ────────────────────────────────────────────────
    '<tr><td style="padding:24px 32px 28px;">' +
      '<div style="border-top:1px solid #f3f4f6;padding-top:18px;text-align:center;">' +
        '<div style="font-size:12px;color:#9ca3af;">Powered by <strong style="color:#1d4ed8;">' + CONFIG.website + '</strong></div>' +
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
function statBox(label, value, color, highlight) {
  return (
    '<td valign="top" style="width:50%;">' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;' +
           (highlight ? 'border-left:3px solid ' + color + ';' : '') + '">' +
        '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px;">' + label + '</div>' +
        '<div style="font-size:' + (highlight ? '21px' : '17px') + ';font-weight:700;color:' + (highlight ? color : '#1e293b') + ';">' + value + '</div>' +
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
