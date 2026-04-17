const db = require('../../config/database');

// ── GET /api/clothing/branches ────────────────────────────────
async function listBranches(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM store_branches WHERE shop_id = $1 AND is_active = TRUE ORDER BY name`,
      [req.shopId]
    );
    res.json({ branches: rows });
  } catch (err) {
    console.error('listBranches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/branches ───────────────────────────────
async function createBranch(req, res) {
  const { name, address = '', phone = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO store_branches (shop_id, name, address, phone)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.shopId, name, address, phone]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createBranch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/clothing/branches/:id ───────────────────────────
async function updateBranch(req, res) {
  const fields = ['name','address','phone','is_active'];
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
      `UPDATE store_branches SET ${updates.join(', ')}
        WHERE id = $1 AND shop_id = $2 RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Branch not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateBranch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/clothing/branches/:id/inventory ─────────────────
async function getBranchInventory(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT bi.*, cv.size, cv.color, cv.sku, cv.barcode,
              cp.name AS product_name, cv.product_id
         FROM branch_inventory bi
         JOIN clothing_variants cv ON cv.id = bi.variant_id
         JOIN clothing_products cp ON cp.id = cv.product_id
         JOIN store_branches sb ON sb.id = bi.branch_id
        WHERE bi.branch_id = $1 AND sb.shop_id = $2
        ORDER BY cp.name, cv.size, cv.color`,
      [req.params.id, req.shopId]
    );
    res.json({ inventory: rows });
  } catch (err) {
    console.error('getBranchInventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── POST /api/clothing/branches/transfer ─────────────────────
async function transferStock(req, res) {
  const { from_branch_id, to_branch_id, variant_id, quantity, note = '' } = req.body;
  const qty = parseInt(quantity, 10);
  if (!from_branch_id || !to_branch_id || !variant_id || !qty || qty < 1) {
    return res.status(400).json({ error: 'from_branch_id, to_branch_id, variant_id, quantity required' });
  }
  if (from_branch_id === to_branch_id) {
    return res.status(400).json({ error: 'Source and destination must differ' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Verify both branches belong to this shop
    const { rows: branches } = await client.query(
      `SELECT id FROM store_branches WHERE id = ANY($1) AND shop_id = $2`,
      [[from_branch_id, to_branch_id], req.shopId]
    );
    if (branches.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid branch IDs' });
    }

    // Deduct from source
    const { rows: src } = await client.query(
      `UPDATE branch_inventory SET stock_quantity = stock_quantity - $1
        WHERE branch_id = $2 AND variant_id = $3 AND stock_quantity >= $1
        RETURNING stock_quantity`,
      [qty, from_branch_id, variant_id]
    );
    if (!src.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock at source branch' });
    }

    // Add to destination (upsert)
    await client.query(
      `INSERT INTO branch_inventory (branch_id, variant_id, stock_quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (branch_id, variant_id)
       DO UPDATE SET stock_quantity = branch_inventory.stock_quantity + $3`,
      [to_branch_id, variant_id, qty]
    );

    await client.query('COMMIT');
    res.json({ success: true, note });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferStock error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
}

module.exports = { listBranches, createBranch, updateBranch, getBranchInventory, transferStock };
