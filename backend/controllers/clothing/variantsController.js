const db = require('../../config/database');

// ── GET /api/clothing/products/:pid/variants ──────────────────
async function listVariants(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT cv.*,
              COALESCE(cv.price_override, cp.base_price) AS effective_price
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.product_id = $1 AND cv.shop_id = $2
        ORDER BY cv.size, cv.color`,
      [req.params.pid, req.shopId]
    );
    res.json({ variants: rows });
  } catch (err) {
    console.error('listVariants error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/products/:pid/variants ─────────────────
async function createVariant(req, res) {
  const {
    size, color, barcode, price_override,
    stock_quantity = 0, low_stock_threshold = 5,
  } = req.body;

  if (!size || !color) {
    return res.status(400).json({ error: 'size and color are required' });
  }

  // Auto-generate SKU if not provided
  const sku = req.body.sku ||
    `${req.shopId}-${req.params.pid}-${size}-${color}`
      .replace(/\s+/g, '-').toUpperCase();

  try {
    const { rows } = await db.query(
      `INSERT INTO clothing_variants
         (shop_id, product_id, size, color, sku, barcode,
          price_override, stock_quantity, low_stock_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.shopId, req.params.pid, size, color, sku,
       barcode || null, price_override || null,
       stock_quantity, low_stock_threshold]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const msg = err.constraint?.includes('barcode')
        ? 'Barcode already exists for another variant'
        : 'A variant with this size and color already exists';
      return res.status(400).json({ error: msg });
    }
    console.error('createVariant error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/clothing/variants/:id ────────────────────────────
async function updateVariant(req, res) {
  const fields = ['size','color','sku','barcode','price_override',
                  'stock_quantity','low_stock_threshold','is_active'];
  const updates = [];
  const params  = [req.params.id, req.shopId];

  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const { rows } = await db.query(
      `UPDATE clothing_variants SET ${updates.join(', ')}
        WHERE id = $1 AND shop_id = $2 RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Variant not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Barcode already exists for another variant' });
    }
    console.error('updateVariant error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/clothing/variants/:id ─────────────────────────
async function deleteVariant(req, res) {
  try {
    const { rows: sold } = await db.query(
      `SELECT 1 FROM transaction_items
        WHERE clothing_variant_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (sold.length) {
      return res.status(400).json({
        error: 'Cannot delete: variant has been sold. Deactivate it instead.',
      });
    }

    const { rows } = await db.query(
      `DELETE FROM clothing_variants WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [req.params.id, req.shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Variant not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteVariant error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/variants/by-barcode/:barcode ────────────
async function getVariantByBarcode(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT cv.*,
              COALESCE(cv.price_override, cp.base_price) AS effective_price,
              cp.name         AS product_name,
              cp.tax_rate     AS tax_rate,
              cp.is_clearance AS is_clearance,
              cp.id           AS clothing_product_id
         FROM clothing_variants cv
         JOIN clothing_products cp ON cp.id = cv.product_id
        WHERE cv.shop_id = $1 AND cv.barcode = $2 AND cv.is_active = TRUE`,
      [req.shopId, req.params.barcode]
    );

    if (!rows.length) {
      return res.status(404).json({ error: `Barcode "${req.params.barcode}" not found` });
    }

    const v = rows[0];
    res.json({
      variant: {
        id: v.id, size: v.size, color: v.color, sku: v.sku,
        barcode: v.barcode, stock_quantity: v.stock_quantity,
        low_stock_threshold: v.low_stock_threshold,
        price_override: v.price_override,
      },
      product: {
        id: v.clothing_product_id,
        name: v.product_name,
        tax_rate: v.tax_rate,
        is_clearance: v.is_clearance,
      },
      effective_price: parseFloat(v.effective_price),
    });
  } catch (err) {
    console.error('getVariantByBarcode error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listVariants, createVariant, updateVariant,
  deleteVariant, getVariantByBarcode,
};
