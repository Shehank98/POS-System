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
  const totalDisc = completed.reduce((s, r) => s + Number(r.discount_amount), 0);

  summary.addRows([
    { metric: 'Report Period',      value: `${startDate} – ${endDate}` },
    { metric: 'Transactions',       value: completed.length },
    { metric: 'Total Revenue',      value: totalRev.toFixed(2) },
    { metric: 'Total Tax',          value: totalTax.toFixed(2) },
    { metric: 'Total Discounts',    value: totalDisc.toFixed(2) },
    { metric: 'Voided Transactions', value: rows.filter((r) => r.status === 'void').length },
  ]);

  styleHeaderRow(summary, 1);

  // ── Transactions sheet ───────────────────────────────────
  const txSheet = wb.addWorksheet('Transactions');
  txSheet.columns = [
    { header: 'Date',         key: 'date',       width: 20 },
    { header: 'Time',         key: 'time',       width: 10 },
    { header: 'Txn #',        key: 'txn_no',     width: 22 },
    { header: 'Cashier',      key: 'cashier',    width: 14 },
    { header: 'Items',        key: 'items',      width: 40 },
    { header: 'Payment',      key: 'payment',    width: 12 },
    { header: 'Discount',     key: 'discount',   width: 12 },
    { header: 'Tax',          key: 'tax',        width: 12 },
    { header: 'Total',        key: 'total',      width: 14 },
    { header: 'Status',       key: 'status',     width: 12 },
  ];

  rows.forEach((r) => {
    const d = new Date(r.transaction_date);
    const itemStr = (r.items || [])
      .map((i) => `${i.name} x${i.qty}`)
      .join(', ');
    txSheet.addRow({
      date:     d.toLocaleDateString('en-GB'),
      time:     d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      txn_no:   r.transaction_number,
      cashier:  r.cashier || '—',
      items:    itemStr,
      payment:  r.payment_method,
      discount: Number(r.discount_amount).toFixed(2),
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

  const pageW  = doc.page.width  - 80; // usable width
  const col    = { date: 0, txn: 80, cashier: 200, payment: 290, total: 360, status: 430 };

  // ── Title ────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(
    `Period: ${startDate} to ${endDate}   |   Generated: ${new Date().toLocaleString()}`,
    { align: 'center' }
  );
  doc.moveDown();

  // ── Summary box ──────────────────────────────────────────
  const completed = rows.filter((r) => r.status === 'completed');
  const totalRev  = completed.reduce((s, r) => s + Number(r.total_amount), 0);

  doc.roundedRect(40, doc.y, pageW, 50, 4).fill('#f3f4f6').stroke('#e5e7eb');
  const boxY = doc.y - 44;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11);
  doc.text(`Transactions: ${completed.length}`, 52, boxY + 10);
  doc.text(`Total Revenue: ${totalRev.toFixed(2)}`, 52, boxY + 26);
  doc.font('Helvetica').fillColor('#374151');
  doc.y = boxY + 60;
  doc.moveDown(0.5);

  // ── Table header ─────────────────────────────────────────
  const headerY = doc.y;
  doc.rect(40, headerY, pageW, 16).fill('#1d4ed8');
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
  const headers = ['Date', 'Txn #', 'Cashier', 'Method', 'Total', 'Status'];
  const colX    = [40, 120, 240, 330, 400, 470];
  headers.forEach((h, i) => doc.text(h, colX[i] + 3, headerY + 4, { width: 80 }));
  doc.y = headerY + 20;

  // ── Rows ─────────────────────────────────────────────────
  rows.forEach((r, idx) => {
    if (doc.y > doc.page.height - 60) { doc.addPage(); }

    const rowY = doc.y;
    const bg   = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
    doc.rect(40, rowY, pageW, 14).fill(bg);

    const d      = new Date(r.transaction_date);
    const dateStr = d.toLocaleDateString('en-GB');
    const vals   = [
      dateStr,
      r.transaction_number,
      r.cashier || '—',
      r.payment_method,
      Number(r.total_amount).toFixed(2),
      r.status,
    ];
    const txtColor = r.status === 'void' ? '#dc2626' : '#111827';
    doc.fillColor(txtColor).font('Helvetica').fontSize(7.5);
    vals.forEach((v, i) => doc.text(String(v), colX[i] + 3, rowY + 3, { width: 75, lineBreak: false }));
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

module.exports = { exportSales, exportInventory };
