const db = require('../../config/database');

// ── GET /api/clothing/products ────────────────────────────────
async function listClothingProducts(req, res) {
  const { search, category, low_stock } = req.query;
  const params = [req.shopId];
  const conditions = ['cp.shop_id = $1', 'cp.is_active = TRUE'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`cp.name ILIKE $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`cp.category = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const havingClause = low_stock === 'true'
    ? 'HAVING SUM(cv.stock_quantity) <= 10 OR COUNT(cv.id) = 0'
    : '';

  try {
    const { rows } = await db.query(
      `SELECT cp.*,
              COUNT(cv.id)            AS variant_count,
              COALESCE(SUM(cv.stock_quantity), 0) AS total_stock
         FROM clothing_products cp
         LEFT JOIN clothing_variants cv
                ON cv.product_id = cp.id AND cv.is_active = TRUE
        WHERE ${where}
        GROUP BY cp.id
        ${havingClause}
        ORDER BY cp.name ASC`,
      params
    );
    res.json({ products: rows });
  } catch (err) {
    console.error('listClothingProducts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/products/:id ────────────────────────────
async function getClothingProduct(req, res) {
  try {
    const { rows: pRows } = await db.query(
      `SELECT * FROM clothing_products WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (!pRows.length) return res.status(404).json({ error: 'Product not found' });

    const { rows: variants } = await db.query(
      `SELECT * FROM clothing_variants
        WHERE product_id = $1
        ORDER BY size, color`,
      [req.params.id]
    );

    res.json({ ...pRows[0], variants });
  } catch (err) {
    console.error('getClothingProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/products ───────────────────────────────
async function createClothingProduct(req, res) {
  const {
    name, description = '', category = '',
    base_price = 0, cost_price = 0, tax_rate = 0,
    is_clearance = false,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO clothing_products
         (shop_id, name, description, category, base_price, cost_price, tax_rate, is_clearance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.shopId, name, description, category,
       base_price, cost_price, tax_rate, is_clearance]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createClothingProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/clothing/products/:id ────────────────────────────
async function updateClothingProduct(req, res) {
  const fields = ['name','description','category','base_price','cost_price',
                  'tax_rate','is_clearance','is_active'];
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
      `UPDATE clothing_products SET ${updates.join(', ')}
        WHERE id = $1 AND shop_id = $2 RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateClothingProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/clothing/products/:id ─────────────────────────
async function deleteClothingProduct(req, res) {
  try {
    const { rows: sold } = await db.query(
      `SELECT 1 FROM transaction_items ti
         JOIN clothing_variants cv ON cv.id = ti.clothing_variant_id
        WHERE cv.product_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (sold.length) {
      return res.status(400).json({
        error: 'Cannot delete: this product has been sold. Deactivate it instead.',
      });
    }

    const { rows } = await db.query(
      `DELETE FROM clothing_products WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [req.params.id, req.shopId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteClothingProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listClothingProducts, getClothingProduct,
  createClothingProduct, updateClothingProduct, deleteClothingProduct,
};
