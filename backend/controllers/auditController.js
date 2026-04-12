const db = require('../config/database');

// ── GET /api/audit-log ────────────────────────────────────────
// Shop owner / manager: view deleted records for their own shop
async function getShopAuditLog(req, res) {
  const { record_type, limit = 50, offset = 0 } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const off = parseInt(offset, 10) || 0;

  const params = [req.shopId, lim, off];
  let typeFilter = '';
  if (record_type) {
    params.push(record_type);
    typeFilter = `AND dr.record_type = $${params.length}`;
  }

  try {
    const { rows } = await db.query(
      `SELECT dr.id,
              dr.record_type,
              dr.record_id,
              dr.deleted_at,
              dr.original_data,
              u.username AS deleted_by
         FROM deleted_records dr
         LEFT JOIN users u ON u.id = dr.deleted_by
        WHERE dr.shop_id = $1
          ${typeFilter}
        ORDER BY dr.deleted_at DESC
        LIMIT $2 OFFSET $3`,
      params
    );

    const countParams = [req.shopId];
    let countFilter = '';
    if (record_type) {
      countParams.push(record_type);
      countFilter = `AND record_type = $${countParams.length}`;
    }
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS total FROM deleted_records WHERE shop_id = $1 ${countFilter}`,
      countParams
    );

    res.json({
      records: rows,
      total:   parseInt(countRows[0].total, 10),
      limit:   lim,
      offset:  off,
    });
  } catch (err) {
    console.error('getShopAuditLog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── GET /api/admin/audit-log ──────────────────────────────────
// Super admin: view all deleted records across every shop
async function getAdminAuditLog(req, res) {
  const { shop_id, record_type, limit = 100, offset = 0 } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  const off = parseInt(offset, 10) || 0;

  // Build WHERE filters dynamically (limit/offset go in first two positions)
  const params  = [lim, off];
  const filters = [];

  if (shop_id) {
    params.push(parseInt(shop_id, 10));
    filters.push(`dr.shop_id = $${params.length}`);
  }
  if (record_type) {
    params.push(record_type);
    filters.push(`dr.record_type = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT dr.id,
              dr.record_type,
              dr.record_id,
              dr.deleted_at,
              dr.original_data,
              s.name  AS shop_name,
              u.username AS deleted_by
         FROM deleted_records dr
         LEFT JOIN shops s ON s.id = dr.shop_id
         LEFT JOIN users u ON u.id = dr.deleted_by
        ${where}
        ORDER BY dr.deleted_at DESC
        LIMIT $1 OFFSET $2`,
      params
    );

    // Count query (no limit/offset)
    const countParams  = [];
    const countFilters = [];
    if (shop_id) {
      countParams.push(parseInt(shop_id, 10));
      countFilters.push(`shop_id = $${countParams.length}`);
    }
    if (record_type) {
      countParams.push(record_type);
      countFilters.push(`record_type = $${countParams.length}`);
    }
    const countWhere = countFilters.length ? `WHERE ${countFilters.join(' AND ')}` : '';
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS total FROM deleted_records ${countWhere}`,
      countParams
    );

    res.json({
      records: rows,
      total:   parseInt(countRows[0].total, 10),
      limit:   lim,
      offset:  off,
    });
  } catch (err) {
    console.error('getAdminAuditLog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getShopAuditLog, getAdminAuditLog };
