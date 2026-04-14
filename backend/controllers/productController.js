const db = require('../config/database');

// ── GET /api/products ─────────────────────────────────────────
async function listProducts(req, res) {
  const { search, category, low_stock, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const params = [req.shopId];
  const conditions = ['shop_id = $1'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR barcode ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (low_stock === 'true') {
    conditions.push(`has_inventory = true AND stock_quantity <= 10`);
  }

  const where = conditions.join(' AND ');

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM products WHERE ${where}`, params
    );
    params.push(parseInt(limit, 10), offset);
    const { rows } = await db.query(
      `SELECT * FROM products WHERE ${where}
       ORDER BY
         CASE
           WHEN has_inventory = true AND stock_quantity <= 0  THEN 0
           WHEN has_inventory = true AND stock_quantity <= 10 THEN 1
           ELSE 2
         END ASC,
         name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      products: rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/products/by-barcode/:barcode ─────────────────────
async function getByBarcode(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM products WHERE shop_id = $1 AND barcode = $2`,
      [req.shopId, req.params.barcode]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getByBarcode error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/products/:id ─────────────────────────────────────
async function getProduct(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM products WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/products ────────────────────────────────────────
async function createProduct(req, res) {
  const {
    name, barcode, price, cost_price = 0,
    stock_quantity = 0, has_inventory = true,
    category, tax_rate = 0,
  } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO products
         (shop_id, name, barcode, price, cost_price, stock_quantity, has_inventory, category, tax_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.shopId, name, barcode || null, price, cost_price,
       stock_quantity, has_inventory, category || null, tax_rate]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A product with this barcode already exists' });
    }
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/products/:id ─────────────────────────────────────
async function updateProduct(req, res) {
  const {
    name, barcode, price, cost_price,
    stock_quantity, has_inventory, category, tax_rate,
  } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE products
          SET name = COALESCE($1, name),
              barcode = $2,
              price = COALESCE($3, price),
              cost_price = COALESCE($4, cost_price),
              stock_quantity = COALESCE($5, stock_quantity),
              has_inventory = COALESCE($6, has_inventory),
              category = $7,
              tax_rate = COALESCE($8, tax_rate)
        WHERE id = $9 AND shop_id = $10
        RETURNING *`,
      [name, barcode ?? null, price, cost_price, stock_quantity, has_inventory,
       category ?? null, tax_rate, req.params.id, req.shopId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A product with this barcode already exists' });
    }
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── DELETE /api/products/:id ──────────────────────────────────
async function deleteProduct(req, res) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM products WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    await client.query(
      `INSERT INTO deleted_records (shop_id, record_type, record_id, deleted_by, original_data)
       VALUES ($1, 'product', $2, $3, $4)`,
      [req.shopId, rows[0].id, req.user.id, JSON.stringify(rows[0])]
    );

    await client.query(`DELETE FROM products WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Product deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

// ── GET /api/products/categories ─────────────────────────────
async function listCategories(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT category FROM products
        WHERE shop_id = $1 AND category IS NOT NULL
        ORDER BY category ASC`,
      [req.shopId]
    );
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listProducts, getByBarcode, getProduct,
  createProduct, updateProduct, deleteProduct,
  listCategories,
};
