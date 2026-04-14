const db = require('../config/database');

// ── GET /api/carwash/dashboard ────────────────────────────────
async function getDashboard(req, res) {
  const shopId = req.shopId;
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)    FROM carwash_jobs WHERE shop_id = $1)                                   AS total_jobs,
        (SELECT COUNT(*)    FROM carwash_jobs WHERE shop_id = $1 AND status = 'waiting')            AS waiting_jobs,
        (SELECT COUNT(*)    FROM carwash_jobs WHERE shop_id = $1 AND status = 'in_progress')        AS in_progress_jobs,
        (SELECT COUNT(*)    FROM carwash_jobs WHERE shop_id = $1 AND DATE(created_at) = $2)         AS today_jobs,
        (SELECT COALESCE(SUM(amount), 0) FROM carwash_payments WHERE shop_id = $1 AND DATE(paid_at) = $2) AS today_revenue,
        (SELECT COUNT(*)    FROM carwash_products WHERE shop_id = $1 AND is_active = TRUE AND stock_quantity < 5) AS low_stock_count
    `, [shopId, today]);

    // Recent jobs (last 8)
    const { rows: recentJobs } = await db.query(`
      SELECT j.id, j.vehicle_number, j.vehicle_type, j.customer_name,
             j.phone_number, j.status, j.created_at,
             u.username AS staff_name
        FROM carwash_jobs j
        LEFT JOIN users u ON u.id = j.assigned_staff_id
       WHERE j.shop_id = $1
       ORDER BY j.created_at DESC
       LIMIT 8
    `, [shopId]);

    res.json({ ...rows[0], recent_jobs: recentJobs });
  } catch (err) {
    console.error('carwash getDashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ══════════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════════

async function listServices(req, res) {
  const { include_inactive } = req.query;
  try {
    const { rows } = await db.query(`
      SELECT * FROM carwash_services
       WHERE shop_id = $1 ${include_inactive !== 'true' ? "AND is_active = TRUE" : ""}
       ORDER BY name ASC
    `, [req.shopId]);
    res.json(rows);
  } catch (err) {
    console.error('listServices error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createService(req, res) {
  const { name, price, duration_minutes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(`
      INSERT INTO carwash_services (shop_id, name, price, duration_minutes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.shopId, name, parseFloat(price) || 0, duration_minutes || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createService error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateService(req, res) {
  const { name, price, duration_minutes, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE carwash_services
         SET name             = COALESCE($1, name),
             price            = COALESCE($2, price),
             duration_minutes = COALESCE($3, duration_minutes),
             is_active        = COALESCE($4, is_active)
       WHERE id = $5 AND shop_id = $6
       RETURNING *
    `, [name || null, price != null ? parseFloat(price) : null, duration_minutes || null,
        is_active != null ? is_active : null, req.params.id, req.shopId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateService error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function deleteService(req, res) {
  try {
    const { rows } = await db.query(`
      UPDATE carwash_services SET is_active = FALSE
       WHERE id = $1 AND shop_id = $2 RETURNING id
    `, [req.params.id, req.shopId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'Service deactivated' });
  } catch (err) {
    console.error('deleteService error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ══════════════════════════════════════════════════════════════
// PRODUCTS (with stock)
// ══════════════════════════════════════════════════════════════

async function listProducts(req, res) {
  const { include_inactive } = req.query;
  try {
    const { rows } = await db.query(`
      SELECT * FROM carwash_products
       WHERE shop_id = $1 ${include_inactive !== 'true' ? "AND is_active = TRUE" : ""}
       ORDER BY name ASC
    `, [req.shopId]);
    res.json(rows);
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createProduct(req, res) {
  const { name, price, stock_quantity, unit } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(`
      INSERT INTO carwash_products (shop_id, name, price, stock_quantity, unit)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.shopId, name, parseFloat(price) || 0, parseInt(stock_quantity, 10) || 0, unit || 'pcs']);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateProduct(req, res) {
  const { name, price, stock_quantity, unit, is_active } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE carwash_products
         SET name           = COALESCE($1, name),
             price          = COALESCE($2, price),
             stock_quantity = COALESCE($3, stock_quantity),
             unit           = COALESCE($4, unit),
             is_active      = COALESCE($5, is_active)
       WHERE id = $6 AND shop_id = $7
       RETURNING *
    `, [name || null, price != null ? parseFloat(price) : null,
        stock_quantity != null ? parseInt(stock_quantity, 10) : null,
        unit || null, is_active != null ? is_active : null,
        req.params.id, req.shopId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function deleteProduct(req, res) {
  try {
    const { rows } = await db.query(`
      UPDATE carwash_products SET is_active = FALSE
       WHERE id = $1 AND shop_id = $2 RETURNING id
    `, [req.params.id, req.shopId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error('deleteProduct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ══════════════════════════════════════════════════════════════
// JOBS
// ══════════════════════════════════════════════════════════════

async function listJobs(req, res) {
  const { status, date, search } = req.query;
  const params = [req.shopId];
  const conditions = ['j.shop_id = $1'];

  if (status)  { params.push(status);  conditions.push(`j.status = $${params.length}`); }
  if (date)    { params.push(date);    conditions.push(`DATE(j.created_at) = $${params.length}`); }
  if (search)  {
    params.push(`%${search}%`);
    const p = params.length;
    conditions.push(`(j.vehicle_number ILIKE $${p} OR j.phone_number ILIKE $${p} OR j.customer_name ILIKE $${p})`);
  }

  try {
    const { rows } = await db.query(`
      SELECT j.*, u.username AS staff_name,
             (SELECT COALESCE(SUM(subtotal), 0) FROM carwash_job_items WHERE job_id = j.id) AS total_amount
        FROM carwash_jobs j
        LEFT JOIN users u ON u.id = j.assigned_staff_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.created_at DESC
       LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('listJobs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getJob(req, res) {
  try {
    const { rows: jobRows } = await db.query(`
      SELECT j.*, u.username AS staff_name
        FROM carwash_jobs j
        LEFT JOIN users u ON u.id = j.assigned_staff_id
       WHERE j.id = $1 AND j.shop_id = $2
    `, [req.params.id, req.shopId]);

    if (jobRows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobRows[0];

    const { rows: items } = await db.query(`
      SELECT ji.*, u.username AS added_by_name
        FROM carwash_job_items ji
        LEFT JOIN users u ON u.id = ji.added_by
       WHERE ji.job_id = $1
       ORDER BY ji.created_at ASC
    `, [job.id]);

    const { rows: payments } = await db.query(`
      SELECT * FROM carwash_payments WHERE job_id = $1 ORDER BY paid_at DESC
    `, [job.id]);

    res.json({ ...job, items, payments });
  } catch (err) {
    console.error('getJob error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createJob(req, res) {
  const {
    vehicle_number, vehicle_type, phone_number, customer_name,
    assigned_staff_id, notes, items = [],
  } = req.body;

  const dbClient = await db.getClient();
  try {
    await dbClient.query('BEGIN');

    const { rows: jobRows } = await dbClient.query(`
      INSERT INTO carwash_jobs
        (shop_id, vehicle_number, vehicle_type, phone_number, customer_name, assigned_staff_id, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [req.shopId, vehicle_number || null, vehicle_type || null,
        phone_number || null, customer_name || null,
        assigned_staff_id || null, notes || null]);

    const job = jobRows[0];

    // Insert any initial items provided at creation time
    for (const item of items) {
      const qty  = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      await dbClient.query(`
        INSERT INTO carwash_job_items
          (job_id, item_type, item_id, item_name, quantity, unit_price, subtotal, added_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [job.id, item.item_type, item.item_id, item.item_name,
          qty, price, qty * price, req.user.id]);
    }

    await dbClient.query('COMMIT');

    // Return full job with items
    const { rows: fullItems } = await db.query(`
      SELECT * FROM carwash_job_items WHERE job_id = $1 ORDER BY created_at ASC
    `, [job.id]);

    res.status(201).json({ ...job, items: fullItems });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('createJob error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
}

async function updateJobStatus(req, res) {
  const { status, assigned_staff_id } = req.body;
  const validStatuses = ['waiting', 'in_progress', 'completed', 'paid'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const dbClient = await db.getClient();
  try {
    await dbClient.query('BEGIN');

    // Fetch current job
    const { rows: current } = await dbClient.query(
      `SELECT * FROM carwash_jobs WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (current.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }

    // Deduct stock when job moves to 'completed'
    if (status === 'completed' && current[0].status !== 'completed') {
      const { rows: productItems } = await dbClient.query(`
        SELECT item_id, quantity FROM carwash_job_items
         WHERE job_id = $1 AND item_type = 'product'
      `, [req.params.id]);

      for (const pi of productItems) {
        await dbClient.query(`
          UPDATE carwash_products
             SET stock_quantity = GREATEST(0, stock_quantity - $1)
           WHERE id = $2 AND shop_id = $3
        `, [Math.ceil(pi.quantity), pi.item_id, req.shopId]);
      }
    }

    const fields = [];
    const vals   = [];

    if (status) {
      vals.push(status);
      fields.push(`status = $${vals.length}`);
    }
    if (assigned_staff_id !== undefined) {
      vals.push(assigned_staff_id || null);
      fields.push(`assigned_staff_id = $${vals.length}`);
    }
    vals.push(new Date());
    fields.push(`updated_at = $${vals.length}`);

    vals.push(req.params.id, req.shopId);
    const { rows } = await dbClient.query(`
      UPDATE carwash_jobs SET ${fields.join(', ')}
       WHERE id = $${vals.length - 1} AND shop_id = $${vals.length}
       RETURNING *
    `, vals);

    await dbClient.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('updateJobStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
}

async function addJobItem(req, res) {
  const { item_type, item_id, item_name, quantity, unit_price } = req.body;
  if (!item_type || !item_id || !item_name) {
    return res.status(400).json({ error: 'item_type, item_id, and item_name are required' });
  }

  try {
    // Verify job belongs to shop
    const { rows: jobCheck } = await db.query(
      `SELECT id, status FROM carwash_jobs WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (jobCheck.length === 0) return res.status(404).json({ error: 'Job not found' });
    if (jobCheck[0].status === 'paid') {
      return res.status(400).json({ error: 'Cannot modify a paid job' });
    }

    const qty   = parseFloat(quantity) || 1;
    const price = parseFloat(unit_price) || 0;

    const { rows } = await db.query(`
      INSERT INTO carwash_job_items
        (job_id, item_type, item_id, item_name, quantity, unit_price, subtotal, added_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [req.params.id, item_type, item_id, item_name, qty, price, qty * price, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('addJobItem error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function removeJobItem(req, res) {
  try {
    // Verify job belongs to shop
    const { rows: jobCheck } = await db.query(
      `SELECT id, status FROM carwash_jobs WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (jobCheck.length === 0) return res.status(404).json({ error: 'Job not found' });
    if (jobCheck[0].status === 'paid') {
      return res.status(400).json({ error: 'Cannot modify a paid job' });
    }

    const { rowCount } = await db.query(
      `DELETE FROM carwash_job_items WHERE id = $1 AND job_id = $2`,
      [req.params.itemId, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error('removeJobItem error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function payJob(req, res) {
  const { amount, payment_method = 'cash' } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  const validMethods = ['cash', 'card', 'digital'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ error: `payment_method must be one of: ${validMethods.join(', ')}` });
  }

  const dbClient = await db.getClient();
  try {
    await dbClient.query('BEGIN');

    const { rows: jobCheck } = await dbClient.query(
      `SELECT id, status FROM carwash_jobs WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (jobCheck.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }
    if (jobCheck[0].status === 'paid') {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'Job already paid' });
    }

    const { rows: payRows } = await dbClient.query(`
      INSERT INTO carwash_payments (job_id, shop_id, amount, payment_method)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, req.shopId, parseFloat(amount), payment_method]);

    await dbClient.query(`
      UPDATE carwash_jobs SET status = 'paid', updated_at = NOW()
       WHERE id = $1 AND shop_id = $2
    `, [req.params.id, req.shopId]);

    await dbClient.query('COMMIT');
    res.status(201).json(payRows[0]);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('payJob error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
}

// ══════════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════

async function listBookings(req, res) {
  const { date, status } = req.query;
  const params = [req.shopId];
  const conditions = ['b.shop_id = $1'];

  if (date) {
    params.push(date);
    conditions.push(`b.booking_date = $${params.length}`);
  } else {
    // No date filter: show all upcoming (today + future), exclude cancelled by default
    conditions.push(`b.booking_date >= CURRENT_DATE`);
  }

  if (status) { params.push(status); conditions.push(`b.status = $${params.length}`); }

  try {
    const { rows } = await db.query(`
      SELECT b.*, s.name AS service_name, u.username AS staff_name
        FROM carwash_bookings b
        LEFT JOIN carwash_services s ON s.id = b.service_id
        LEFT JOIN users u ON u.id = b.assigned_staff_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.booking_date ASC, b.time_slot ASC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('listBookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createBooking(req, res) {
  const {
    vehicle_number, phone_number, customer_name,
    service_id, booking_date, time_slot,
    assigned_staff_id, notes,
  } = req.body;

  if (!booking_date || !time_slot) {
    return res.status(400).json({ error: 'booking_date and time_slot are required' });
  }

  try {
    const { rows } = await db.query(`
      INSERT INTO carwash_bookings
        (shop_id, vehicle_number, phone_number, customer_name,
         service_id, booking_date, time_slot, assigned_staff_id, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [req.shopId, vehicle_number || null, phone_number || null,
        customer_name || null, service_id || null,
        booking_date, time_slot, assigned_staff_id || null, notes || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createBooking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateBooking(req, res) {
  const {
    vehicle_number, phone_number, customer_name,
    service_id, booking_date, time_slot, assigned_staff_id, notes,
  } = req.body;

  try {
    const { rows } = await db.query(`
      UPDATE carwash_bookings
         SET vehicle_number    = COALESCE($1, vehicle_number),
             phone_number      = COALESCE($2, phone_number),
             customer_name     = COALESCE($3, customer_name),
             service_id        = COALESCE($4, service_id),
             booking_date      = COALESCE($5, booking_date),
             time_slot         = COALESCE($6, time_slot),
             assigned_staff_id = COALESCE($7, assigned_staff_id),
             notes             = COALESCE($8, notes)
       WHERE id = $9 AND shop_id = $10
       RETURNING *
    `, [vehicle_number || null, phone_number || null, customer_name || null,
        service_id || null, booking_date || null, time_slot || null,
        assigned_staff_id || null, notes || null,
        req.params.id, req.shopId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateBooking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateBookingStatus(req, res) {
  const { status } = req.body;
  const valid = ['booked', 'arrived', 'converted_to_job', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    const { rows } = await db.query(`
      UPDATE carwash_bookings SET status = $1
       WHERE id = $2 AND shop_id = $3
       RETURNING *
    `, [status, req.params.id, req.shopId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateBookingStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function convertBooking(req, res) {
  const dbClient = await db.getClient();
  try {
    await dbClient.query('BEGIN');

    const { rows: bookingRows } = await dbClient.query(
      `SELECT * FROM carwash_bookings WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    if (bookingRows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = bookingRows[0];
    if (booking.status === 'converted_to_job') {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking already converted to a job' });
    }

    // Create job from booking
    const { rows: jobRows } = await dbClient.query(`
      INSERT INTO carwash_jobs
        (shop_id, vehicle_number, phone_number, customer_name,
         assigned_staff_id, booking_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,'waiting')
      RETURNING *
    `, [req.shopId, booking.vehicle_number, booking.phone_number,
        booking.customer_name, booking.assigned_staff_id, booking.id]);

    const job = jobRows[0];

    // Add the booked service as an initial job item if service_id provided
    if (booking.service_id) {
      const { rows: svcRows } = await dbClient.query(
        `SELECT * FROM carwash_services WHERE id = $1`,
        [booking.service_id]
      );
      if (svcRows.length > 0) {
        const svc = svcRows[0];
        await dbClient.query(`
          INSERT INTO carwash_job_items
            (job_id, item_type, item_id, item_name, quantity, unit_price, subtotal, added_by)
          VALUES ($1,'service',$2,$3,1,$4,$5,$6)
        `, [job.id, svc.id, svc.name, svc.price, svc.price, req.user.id]);
      }
    }

    // Mark booking as converted
    await dbClient.query(
      `UPDATE carwash_bookings SET status = 'converted_to_job' WHERE id = $1`,
      [booking.id]
    );

    await dbClient.query('COMMIT');
    res.status(201).json({ job, booking_id: booking.id });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('convertBooking error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
}

// ══════════════════════════════════════════════════════════════
// STAFF VIEW — my jobs + upcoming bookings
// ══════════════════════════════════════════════════════════════

async function getStaffView(req, res) {
  const staffId = req.user.id;
  const today   = new Date().toISOString().slice(0, 10);

  try {
    const { rows: myJobs } = await db.query(`
      SELECT j.*,
             (SELECT COALESCE(SUM(subtotal), 0) FROM carwash_job_items WHERE job_id = j.id) AS total_amount
        FROM carwash_jobs j
       WHERE j.shop_id = $1 AND j.assigned_staff_id = $2
         AND DATE(j.created_at) = $3
         AND j.status NOT IN ('paid')
       ORDER BY j.created_at DESC
    `, [req.shopId, staffId, today]);

    const { rows: upcomingBookings } = await db.query(`
      SELECT b.*, s.name AS service_name
        FROM carwash_bookings b
        LEFT JOIN carwash_services s ON s.id = b.service_id
       WHERE b.shop_id = $1 AND b.assigned_staff_id = $2
         AND b.booking_date >= $3
         AND b.status IN ('booked','arrived')
       ORDER BY b.booking_date ASC, b.time_slot ASC
       LIMIT 10
    `, [req.shopId, staffId, today]);

    res.json({ my_jobs: myJobs, upcoming_bookings: upcomingBookings });
  } catch (err) {
    console.error('getStaffView error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC — Customer portal (no auth)
// ══════════════════════════════════════════════════════════════

async function publicLookup(req, res) {
  const { shop_id, phone, vehicle } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });
  if (!phone && !vehicle) return res.status(400).json({ error: 'phone or vehicle is required' });

  try {
    const params = [parseInt(shop_id, 10)];
    const conditions = ['j.shop_id = $1'];

    if (phone) {
      params.push(`%${phone}%`);
      conditions.push(`j.phone_number ILIKE $${params.length}`);
    }
    if (vehicle) {
      params.push(`%${vehicle}%`);
      conditions.push(`j.vehicle_number ILIKE $${params.length}`);
    }

    const { rows: jobs } = await db.query(`
      SELECT j.id, j.vehicle_number, j.vehicle_type, j.customer_name,
             j.phone_number, j.status, j.created_at,
             (SELECT COALESCE(SUM(subtotal), 0) FROM carwash_job_items WHERE job_id = j.id) AS total_amount
        FROM carwash_jobs j
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.created_at DESC
       LIMIT 10
    `, params);

    const { rows: bookings } = await db.query(`
      SELECT b.id, b.vehicle_number, b.customer_name, b.phone_number,
             b.booking_date, b.time_slot, b.status, s.name AS service_name
        FROM carwash_bookings b
        LEFT JOIN carwash_services s ON s.id = b.service_id
       WHERE b.shop_id = $1
         AND (${phone ? `b.phone_number ILIKE $2` : `b.vehicle_number ILIKE $2`})
         AND b.status NOT IN ('cancelled','converted_to_job')
       ORDER BY b.booking_date ASC
       LIMIT 5
    `, [parseInt(shop_id, 10), phone ? `%${phone}%` : `%${vehicle}%`]);

    res.json({ jobs, bookings });
  } catch (err) {
    console.error('publicLookup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function publicShopInfo(req, res) {
  const { shop_id } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

  try {
    const { rows: shopRows } = await db.query(
      `SELECT id, name, phone, address FROM shops WHERE id = $1 AND shop_type = 'car_wash'`,
      [parseInt(shop_id, 10)]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const { rows: services } = await db.query(
      `SELECT id, name, price, duration_minutes FROM carwash_services WHERE shop_id = $1 AND is_active = TRUE ORDER BY name`,
      [parseInt(shop_id, 10)]
    );

    res.json({ shop: shopRows[0], services });
  } catch (err) {
    console.error('publicShopInfo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function publicCreateBooking(req, res) {
  const {
    shop_id, vehicle_number, phone_number, customer_name,
    service_id, booking_date, time_slot, notes,
  } = req.body;

  if (!shop_id || !booking_date || !time_slot) {
    return res.status(400).json({ error: 'shop_id, booking_date and time_slot are required' });
  }

  try {
    // Verify shop exists and is a car wash
    const { rows: shopCheck } = await db.query(
      `SELECT id FROM shops WHERE id = $1 AND shop_type = 'car_wash'`,
      [parseInt(shop_id, 10)]
    );
    if (shopCheck.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const { rows } = await db.query(`
      INSERT INTO carwash_bookings
        (shop_id, vehicle_number, phone_number, customer_name,
         service_id, booking_date, time_slot, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, vehicle_number, phone_number, customer_name,
                booking_date, time_slot, status, created_at
    `, [parseInt(shop_id, 10), vehicle_number || null, phone_number || null,
        customer_name || null, service_id || null,
        booking_date, time_slot, notes || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('publicCreateBooking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getDashboard,
  // services
  listServices, createService, updateService, deleteService,
  // products
  listProducts, createProduct, updateProduct, deleteProduct,
  // jobs
  listJobs, getJob, createJob, updateJobStatus, addJobItem, removeJobItem, payJob,
  // bookings
  listBookings, createBooking, updateBooking, updateBookingStatus, convertBooking,
  // staff
  getStaffView,
  // public
  publicLookup, publicShopInfo, publicCreateBooking,
};
