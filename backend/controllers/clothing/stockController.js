const db     = require('../../config/database');
const PDFDoc = require('pdfkit');
const bwipjs = require('bwip-js');

// ── POST /api/clothing/variants/:id/adjust ────────────────────
async function adjustStock(req, res) {
  const { delta, reason = 'correction', note = '' } = req.body;
  const d = parseInt(delta, 10);
  if (!d) return res.status(400).json({ error: 'delta must be a non-zero integer' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT cv.*, cp.name AS product_name
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.id = $1 AND cv.shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Variant not found' });
    }

    const variant = rows[0];
    const newQty  = variant.stock_quantity + d;
    if (newQty < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot reduce below zero (current: ${variant.stock_quantity})` });
    }

    await client.query(
      `UPDATE clothing_variants SET stock_quantity = $1 WHERE id = $2`,
      [newQty, variant.id]
    );

    await client.query(
      `INSERT INTO clothing_stock_adjustments
         (shop_id, variant_id, user_id, delta, reason, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.shopId, variant.id, req.user.id, d, reason, note]
    );

    await client.query('COMMIT');
    res.json({ id: variant.id, stock_quantity: newQty });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adjustStock error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
}

// ── GET /api/clothing/variants/:id/stock-history ──────────────
async function getStockHistory(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT csa.*, u.username
         FROM clothing_stock_adjustments csa
         LEFT JOIN users u ON u.id = csa.user_id
        WHERE csa.variant_id = $1 AND csa.shop_id = $2
        ORDER BY csa.created_at DESC LIMIT 100`,
      [req.params.id, req.shopId]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('getStockHistory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/variants/low-stock ──────────────────────
async function getLowStockVariants(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT cv.*, cp.name AS product_name
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.shop_id = $1
          AND cv.is_active = TRUE
          AND cv.stock_quantity <= cv.low_stock_threshold
        ORDER BY cv.stock_quantity ASC, cp.name`,
      [req.shopId]
    );
    res.json({ variants: rows });
  } catch (err) {
    console.error('getLowStockVariants error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Generate CODE128 barcode PNG buffer ───────────────────────
async function makeBarcodePng(text, widthPt, heightMm) {
  // bwip-js works in mm; we convert pts to mm (1pt = 0.352778mm)
  const widthMm = widthPt * 0.352778;
  return bwipjs.toBuffer({
    bcid:        'code128',
    text,
    scale:       2,
    height:      heightMm,
    width:       widthMm,
    includetext: false,   // we print the text manually below the bar
    backgroundcolor: 'ffffff',
  });
}

// ── GET /api/clothing/variants/labels?ids=1,2,3 ───────────────
// Label size: 80mm × 40mm thermal label (226pt × 113pt)
// Each page = one label with:
//   • Product name  (top, bold)
//   • Size / Color  (line 2)
//   • Price         (line 3)
//   • CODE128 barcode spanning full width  (center)
//   • Barcode text below barcode
//   • SKU small text at bottom
async function generateBarcodeLabels(req, res) {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'ids query param required' });

  // Label dimensions in points  (80mm × 40mm)
  const LW = 226.77;  // 80mm in pt
  const LH = 113.39;  // 40mm in pt
  const PAD = 8;      // horizontal padding

  try {
    const { rows: variants } = await db.query(
      `SELECT cv.*, cp.name AS product_name,
              COALESCE(cv.price_override, cp.base_price) AS effective_price
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.id = ANY($1) AND cv.shop_id = $2`,
      [ids, req.shopId]
    );

    const doc = new PDFDoc({ size: [LW, LH], margin: 0, autoFirstPage: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="barcode-labels.pdf"');
    doc.pipe(res);

    for (const v of variants) {
      doc.addPage({ size: [LW, LH], margin: 0 });

      const scanText = v.barcode || v.sku || String(v.id);
      const price    = `Rs. ${parseFloat(v.effective_price).toFixed(2)}`;

      // ── Text block (top) ─────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold')
         .text(v.product_name, PAD, 7, { width: LW - PAD * 2, ellipsis: true });

      doc.fontSize(8).font('Helvetica')
         .text(`${v.size}  /  ${v.color}`, PAD, 19, { width: LW - PAD * 2 });

      doc.fontSize(8).font('Helvetica-Bold')
         .text(price, PAD, 30, { width: LW - PAD * 2 });

      // ── CODE128 barcode ──────────────────────────────────
      const bcWidth  = LW - PAD * 2;   // pts
      const bcHeightMm = 14;           // mm tall bars

      let bcBuf = null;
      try {
        bcBuf = await makeBarcodePng(scanText, bcWidth, bcHeightMm);
      } catch (bwErr) {
        console.warn('bwip-js encode failed for', scanText, bwErr.message);
      }

      const bcY = 44;
      if (bcBuf) {
        // height in pts: 14mm ≈ 39.7pt
        doc.image(bcBuf, PAD, bcY, { width: bcWidth, height: 39.7 });
      }

      // Barcode text (human-readable) below the bars
      doc.fontSize(6.5).font('Courier')
         .fillColor('#000')
         .text(scanText, PAD, bcY + 42, { width: LW - PAD * 2, align: 'center' });

      // SKU footnote
      if (v.sku) {
        doc.fontSize(5.5).font('Helvetica').fillColor('#888')
           .text(`SKU: ${v.sku}`, PAD, LH - 10, { width: LW - PAD * 2 });
      }
    }

    doc.end();
  } catch (err) {
    console.error('generateBarcodeLabels error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error generating labels' });
  }
}

module.exports = { adjustStock, getStockHistory, getLowStockVariants, generateBarcodeLabels };
