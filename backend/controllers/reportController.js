const db      = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDoc  = require('pdfkit');

// ── Shared query: fetch sales rows for date range ─────────────
async function fetchSalesRows(shopId, startDate, endDate) {
  const { rows } = await db.query(
    `SELECT
       t.transaction_date,
       t.transaction_number,
       t.payment_method,
       t.total_amount,
       t.tax_amount,
       t.discount_amount,
       t.status,
       u.username AS cashier,
       COALESCE(
         json_agg(
           json_build_object(
             'name',     COALESCE(p.name, 'Deleted product'),
             'qty',      ti.quantity,
             'price',    ti.unit_price,
             'subtotal', ti.subtotal
           )
         ) FILTER (WHERE ti.id IS NOT NULL),
         '[]'
       ) AS items
     FROM transactions t
     LEFT JOIN users             u  ON u.id  = t.user_id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     LEFT JOIN products          p  ON p.id  = ti.product_id
    WHERE t.shop_id = $1
      AND t.transaction_date >= $2
      AND t.transaction_date <= ($3::date + INTERVAL '1 day' - INTERVAL '1 second')
    GROUP BY t.id, u.username
    ORDER BY t.transaction_date ASC`,
    [shopId, startDate, endDate]
  );
  return rows;
}

async function fetchInventoryRows(shopId) {
  const { rows } = await db.query(
    `SELECT name, barcode, category, price, cost_price,
            stock_quantity, has_inventory, tax_rate, created_at
       FROM products
      WHERE shop_id = $1
      ORDER BY category ASC, name ASC`,
    [shopId]
  );
  return rows;
}

// ── GET /api/reports/sales ────────────────────────────────────
async function exportSales(req, res) {
  const { start_date, end_date, format = 'excel' } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  try {
    const rows = await fetchSalesRows(req.shopId, start_date, end_date);

    if (format === 'pdf') {
      return exportSalesPDF(res, rows, start_date, end_date);
    }
    return exportSalesExcel(res, rows, start_date, end_date);
  } catch (err) {
    console.error('exportSales error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}

// ── Helper: compute total discount for a row ─────────────────
// Includes both the order-level discount and any per-item discounts
// (item discounts reduce ti.subtotal relative to unit_price × qty but
// are not stored in t.discount_amount).
function rowTotalDiscount(r) {
  const orderDisc = Number(r.discount_amount) || 0;
  const itemDisc  = (r.items || []).reduce((s, i) =>
    s + Math.max(0, Number(i.price) * Number(i.qty) - Number(i.subtotal)), 0);
  return orderDisc + itemDisc;
}

// ── Excel export ──────────────────────────────────────────────
async function exportSalesExcel(res, rows, startDate, endDate) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POS SaaS';
  wb.created = new Date();

  // ── Summary sheet ────────────────────────────────────────
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value',  key: 'value',  width: 20 },
  ];

  const completed = rows.filter((r) => r.status === 'completed');
  const totalRev  = completed.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalTax  = completed.reduce((s, r) => s + Number(r.tax_amount),   0);
  const totalDisc = completed.reduce((s, r) => s + rowTotalDiscount(r),    0);

  summary.addRows([
    { metric: 'Report Period',       value: `${startDate} – ${endDate}` },
    { metric: 'Transactions',        value: completed.length },
    { metric: 'Total Revenue',       value: totalRev.toFixed(2) },
    { metric: 'Total Tax',           value: totalTax.toFixed(2) },
    { metric: 'Total Discounts',     value: totalDisc.toFixed(2) },
    { metric: 'Voided Transactions', value: rows.filter((r) => r.status === 'void').length },
  ]);

  styleHeaderRow(summary, 1);

  // ── Transactions sheet ───────────────────────────────────
  const txSheet = wb.addWorksheet('Transactions');
  txSheet.columns = [
    { header: 'Date',     key: 'date',     width: 20 },
    { header: 'Time',     key: 'time',     width: 10 },
    { header: 'Txn #',   key: 'txn_no',   width: 26 },
    { header: 'Cashier', key: 'cashier',  width: 14 },
    { header: 'Items',   key: 'items',    width: 40 },
    { header: 'Payment', key: 'payment',  width: 12 },
    { header: 'Discount',key: 'discount', width: 12 },
    { header: 'Tax',     key: 'tax',      width: 12 },
    { header: 'Total',   key: 'total',    width: 14 },
    { header: 'Status',  key: 'status',   width: 12 },
  ];

  rows.forEach((r) => {
    const d        = new Date(r.transaction_date);
    const itemStr  = (r.items || []).map((i) => `${i.name} x${i.qty}`).join(', ');
    const discount = rowTotalDiscount(r);
    txSheet.addRow({
      date:     d.toLocaleDateString('en-GB'),
      time:     d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      txn_no:   r.transaction_number,
      cashier:  r.cashier || '—',
      items:    itemStr,
      payment:  r.payment_method,
      discount: discount.toFixed(2),
      tax:      Number(r.tax_amount).toFixed(2),
      total:    Number(r.total_amount).toFixed(2),
      status:   r.status,
    });
  });

  styleHeaderRow(txSheet, 1);
  numberCol(txSheet, 'discount');
  numberCol(txSheet, 'tax');
  numberCol(txSheet, 'total');

  // ── Line-items sheet ─────────────────────────────────────
  const liSheet = wb.addWorksheet('Line Items');
  liSheet.columns = [
    { header: 'Txn #',        key: 'txn_no',     width: 22 },
    { header: 'Date',         key: 'date',        width: 14 },
    { header: 'Product',      key: 'product',     width: 28 },
    { header: 'Qty',          key: 'qty',         width: 8  },
    { header: 'Unit Price',   key: 'unit_price',  width: 14 },
    { header: 'Subtotal',     key: 'subtotal',    width: 14 },
  ];

  rows.forEach((r) => {
    const d = new Date(r.transaction_date).toLocaleDateString('en-GB');
    (r.items || []).forEach((i) => {
      liSheet.addRow({
        txn_no:    r.transaction_number,
        date:      d,
        product:   i.name,
        qty:       Number(i.qty),
        unit_price: Number(i.price).toFixed(2),
        subtotal:  Number(i.subtotal).toFixed(2),
      });
    });
  });

  styleHeaderRow(liSheet, 1);

  const filename = `sales_${startDate}_to_${endDate}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ── PDF export ────────────────────────────────────────────────
function exportSalesPDF(res, rows, startDate, endDate) {
  const doc      = new PDFDoc({ margin: 40, size: 'A4' });
  const filename = `sales_${startDate}_to_${endDate}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const L     = 40;                        // left margin
  const pageW = doc.page.width - 2 * L;   // 515pt usable (A4 = 595.28)

  // ── Title section ────────────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827')
     .text('Sales Report', L, 40, { align: 'center', width: pageW });
  doc.moveDown(0.25);
  doc.fontSize(9).font('Helvetica').fillColor('#374151')
     .text(`Period: ${startDate}  to  ${endDate}`, L, doc.y, { align: 'center', width: pageW });
  doc.fontSize(7.5).fillColor('#9ca3af')
     .text(`Generated: ${new Date().toLocaleString()}`, L, doc.y + 2, { align: 'center', width: pageW });
  doc.moveDown(1);

  // ── Summary box ──────────────────────────────────────────
  // Save Y BEFORE fill() so text positions don't drift
  const completed = rows.filter((r) => r.status === 'completed');
  const voided    = rows.filter((r) => r.status === 'void');
  const totalRev  = completed.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalTax  = completed.reduce((s, r) => s + Number(r.tax_amount),   0);
  const totalDisc = completed.reduce((s, r) => s + rowTotalDiscount(r),    0);

  const boxTop = doc.y;
  const boxH   = 52;
  doc.roundedRect(L, boxTop, pageW, boxH, 5).fill('#eff6ff').stroke('#bfdbfe');

  const secW = pageW / 5;
  const stats = [
    { label: 'Transactions', value: String(completed.length) },
    { label: 'Revenue',      value: totalRev.toFixed(2)      },
    { label: 'Tax Collected',value: totalTax.toFixed(2)      },
    { label: 'Discounts',    value: totalDisc.toFixed(2)     },
    { label: 'Voided',       value: String(voided.length)    },
  ];
  stats.forEach((s, i) => {
    const sx = L + i * secW;
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7)
       .text(s.label, sx + 2, boxTop + 8, { width: secW - 4, align: 'center', lineBreak: false });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
       .text(s.value, sx + 2, boxTop + 20, { width: secW - 4, align: 'center', lineBreak: false });
  });
  doc.y = boxTop + boxH + 14;

  // ── Column layout ─────────────────────────────────────────
  // Total usable: L=40, rightEdge=555 (40+515).
  // colX: left edge of each column.
  // colW: text-available width inside each cell (colX[i+1] - colX[i] - 4).
  const headers = ['Date',  'Txn #', 'Cashier', 'Method', 'Discount', 'Tax',  'Total', 'Status'];
  const colX    = [40,       95,      235,        295,       350,        402,    450,     505    ];
  const colW    = [51,      136,       56,         51,        48,         44,     51,      46    ];

  function drawTableHeader(y) {
    doc.rect(L, y, pageW, 17).fill('#1d4ed8');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5);
    headers.forEach((h, i) => {
      doc.text(h, colX[i] + 2, y + 4, { width: colW[i], lineBreak: false });
    });
    return y + 20;
  }

  doc.y = drawTableHeader(doc.y);

  // ── Data rows ─────────────────────────────────────────────
  rows.forEach((r, idx) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      doc.y = drawTableHeader(doc.y);
    }

    const rowY      = doc.y;
    const bg        = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(L, rowY, pageW, 14).fill(bg);

    const d         = new Date(r.transaction_date);
    const dateStr   = d.toLocaleDateString('en-GB');
    const disc      = rowTotalDiscount(r);
    const vals      = [
      dateStr,
      r.transaction_number,
      r.cashier || '—',
      r.payment_method,
      disc > 0 ? disc.toFixed(2) : '—',
      Number(r.tax_amount) > 0 ? Number(r.tax_amount).toFixed(2) : '—',
      Number(r.total_amount).toFixed(2),
      r.status,
    ];

    const txtColor = r.status === 'void' ? '#dc2626' : '#111827';
    doc.fillColor(txtColor).font('Helvetica').fontSize(7);
    vals.forEach((v, i) => {
      doc.text(String(v), colX[i] + 2, rowY + 3, { width: colW[i], lineBreak: false });
    });
    doc.y = rowY + 16;
  });

  doc.end();
}

// ── GET /api/reports/inventory ────────────────────────────────
async function exportInventory(req, res) {
  const { format = 'excel' } = req.query;
  try {
    const rows = await fetchInventoryRows(req.shopId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'POS SaaS';
    const ws = wb.addWorksheet('Inventory');

    ws.columns = [
      { header: 'Name',           key: 'name',          width: 30 },
      { header: 'Barcode',        key: 'barcode',        width: 18 },
      { header: 'Category',       key: 'category',       width: 16 },
      { header: 'Selling Price',  key: 'price',          width: 16 },
      { header: 'Cost Price',     key: 'cost_price',     width: 14 },
      { header: 'Stock Qty',      key: 'stock_quantity', width: 12 },
      { header: 'Track Inv.',     key: 'has_inventory',  width: 12 },
      { header: 'Tax Rate (%)',   key: 'tax_rate',       width: 14 },
    ];

    rows.forEach((r) => ws.addRow({
      name:          r.name,
      barcode:       r.barcode || '',
      category:      r.category || '',
      price:         Number(r.price).toFixed(2),
      cost_price:    Number(r.cost_price).toFixed(2),
      stock_quantity: r.stock_quantity,
      has_inventory: r.has_inventory ? 'Yes' : 'No',
      tax_rate:      Number(r.tax_rate),
    }));

    styleHeaderRow(ws, 1);

    // Highlight low-stock rows red
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const cell = row.getCell('stock_quantity');
      if (Number(cell.value) < 10) {
        row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; });
        cell.font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventory_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('exportInventory error:', err);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
}

// ── Helpers ───────────────────────────────────────────────────
function styleHeaderRow(ws, rowNum) {
  const row = ws.getRow(rowNum);
  row.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  row.alignment = { vertical: 'middle' };
  row.height    = 18;
}

function numberCol(ws, key) {
  ws.getColumn(key).numFmt = '#,##0.00';
}

// ── GET /api/reports/tax ──────────────────────────────────────
async function getTaxReport(req, res) {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  try {
    const [summaryRes, byDayRes, byRateRes] = await Promise.all([
      // Overall totals
      db.query(
        `SELECT
           COUNT(*)                                   AS total_transactions,
           COALESCE(SUM(total_amount),    0)          AS total_revenue,
           COALESCE(SUM(tax_amount),      0)          AS total_tax_collected,
           COALESCE(SUM(total_amount) - SUM(tax_amount) - SUM(discount_amount), 0)
                                                      AS taxable_sales
           FROM transactions
          WHERE shop_id  = $1
            AND status   = 'completed'
            AND transaction_date >= $2
            AND transaction_date <= ($3::date + INTERVAL '1 day' - INTERVAL '1 second')`,
        [req.shopId, start_date, end_date]
      ),

      // Daily breakdown
      db.query(
        `SELECT DATE(transaction_date AT TIME ZONE 'UTC') AS day,
                COUNT(*)                      AS transactions,
                COALESCE(SUM(total_amount),0) AS revenue,
                COALESCE(SUM(tax_amount),  0) AS tax_amount
           FROM transactions
          WHERE shop_id  = $1
            AND status   = 'completed'
            AND transaction_date >= $2
            AND transaction_date <= ($3::date + INTERVAL '1 day' - INTERVAL '1 second')
          GROUP BY day
          ORDER BY day ASC`,
        [req.shopId, start_date, end_date]
      ),

      // Breakdown by product tax rate
      db.query(
        `SELECT p.tax_rate,
                COUNT(DISTINCT t.id)          AS transactions,
                COALESCE(SUM(ti.subtotal), 0) AS taxable_amount,
                COALESCE(SUM(ti.subtotal * p.tax_rate / 100), 0) AS tax_amount
           FROM transaction_items ti
           JOIN transactions t ON t.id = ti.transaction_id
           JOIN products      p ON p.id = ti.product_id
          WHERE t.shop_id = $1
            AND t.status  = 'completed'
            AND t.transaction_date >= $2
            AND t.transaction_date <= ($3::date + INTERVAL '1 day' - INTERVAL '1 second')
            AND p.tax_rate > 0
          GROUP BY p.tax_rate
          ORDER BY p.tax_rate ASC`,
        [req.shopId, start_date, end_date]
      ),
    ]);

    res.json({
      period: { start: start_date, end: end_date },
      summary:      summaryRes.rows[0],
      by_day:       byDayRes.rows,
      by_tax_rate:  byRateRes.rows,
    });
  } catch (err) {
    console.error('getTaxReport error:', err);
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
}

module.exports = { exportSales, exportInventory, getTaxReport };
