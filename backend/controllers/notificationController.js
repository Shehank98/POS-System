const db = require('../config/database');

// ── Notification types ────────────────────────────────────────
const TYPES = {
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  SUBSCRIPTION_EXPIRED:  'subscription_expired',
  LOW_STOCK:             'low_stock',
  PAYMENT_APPROVED:      'payment_approved',
  PAYMENT_REJECTED:      'payment_rejected',
  ADMIN_BROADCAST:       'admin_broadcast',
};

// ── Internal helper ───────────────────────────────────────────
async function createNotification(shop_id, type, title, message, data = null) {
  try {
    await db.query(
      `INSERT INTO notifications (shop_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [shop_id, type, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err.message);
  }
}

// ── GET /api/notifications ────────────────────────────────────
async function getNotifications(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM notifications
       WHERE shop_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.shopId]
    );
    const unread_count = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unread_count });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/notifications/:id/read ──────────────────────────
async function markRead(req, res) {
  try {
    await db.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.shopId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/notifications/read-all ──────────────────────────
async function markAllRead(req, res) {
  try {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE shop_id = $1`,
      [req.shopId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Cron: daily subscription + low-stock checks ───────────────
async function runDailyChecks() {
  console.log('[Cron] Running daily checks...');
  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. Subscriptions expiring in <= 5 days
    const { rows: expiringSoon } = await db.query(`
      SELECT id, name, subscription_end_date
        FROM shops
       WHERE subscription_status IN ('active', 'trial')
         AND subscription_end_date IS NOT NULL
         AND subscription_end_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '5 days')
    `);

    for (const shop of expiringSoon) {
      const { rows: dup } = await db.query(
        `SELECT id FROM notifications
         WHERE shop_id = $1 AND type = $2 AND created_at::date = $3`,
        [shop.id, TYPES.SUBSCRIPTION_EXPIRING, today]
      );
      if (dup.length === 0) {
        const end = new Date(shop.subscription_end_date);
        const diffDays = Math.ceil((end - new Date()) / 86400000);
        await createNotification(
          shop.id,
          TYPES.SUBSCRIPTION_EXPIRING,
          'Subscription Expiring Soon',
          `Your subscription expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}. Please renew to avoid service interruption.`,
          { days_remaining: diffDays, end_date: shop.subscription_end_date }
        );
      }
    }

    // 2. Subscriptions that have expired — update status + notify
    const { rows: expired } = await db.query(`
      SELECT id, name FROM shops
      WHERE subscription_status IN ('active', 'trial')
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < CURRENT_DATE
    `);

    for (const shop of expired) {
      // Update shop status to expired
      await db.query(
        `UPDATE shops SET subscription_status = 'expired' WHERE id = $1`,
        [shop.id]
      );

      const { rows: dup } = await db.query(
        `SELECT id FROM notifications
         WHERE shop_id = $1 AND type = $2 AND created_at::date = $3`,
        [shop.id, TYPES.SUBSCRIPTION_EXPIRED, today]
      );
      if (dup.length === 0) {
        await createNotification(
          shop.id,
          TYPES.SUBSCRIPTION_EXPIRED,
          'Subscription Expired',
          'Your subscription has expired. You are now in read-only mode. Please submit a payment to renew.',
          {}
        );
      }
    }

    // 3. Low stock (< 10 units)
    const { rows: lowShops } = await db.query(`
      SELECT DISTINCT shop_id FROM products
      WHERE has_inventory = TRUE AND stock_quantity < 10 AND stock_quantity >= 0
    `);

    for (const { shop_id } of lowShops) {
      const { rows: dup } = await db.query(
        `SELECT id FROM notifications
         WHERE shop_id = $1 AND type = $2 AND created_at::date = $3`,
        [shop_id, TYPES.LOW_STOCK, today]
      );
      if (dup.length > 0) continue;

      const { rows: products } = await db.query(`
        SELECT name, stock_quantity FROM products
        WHERE shop_id = $1 AND has_inventory = TRUE AND stock_quantity < 10
        ORDER BY stock_quantity ASC
        LIMIT 10
      `, [shop_id]);

      if (products.length > 0) {
        const list = products.map((p) => `${p.name} (${p.stock_quantity} left)`).join(', ');
        await createNotification(
          shop_id,
          TYPES.LOW_STOCK,
          `${products.length} Product${products.length > 1 ? 's' : ''} Low on Stock`,
          `Low stock alert: ${list}`,
          { products: products.map((p) => ({ name: p.name, qty: p.stock_quantity })) }
        );
      }
    }

    console.log('[Cron] Daily checks complete');
  } catch (err) {
    console.error('[Cron] Error during daily checks:', err);
  }
}

// ── Agent notification types ──────────────────────────────────
const AGENT_TYPES = {
  PAYMENT_VERIFIED:    'payment_verified',
  PAYMENT_REJECTED:    'payment_rejected',
  COMMISSION_APPROVED: 'commission_approved',
  PAYOUT_PROCESSED:    'payout_processed',
};

// ── Internal helper: create agent notification ────────────────
async function createAgentNotification(agentId, type, title, message, data = null) {
  try {
    await db.query(
      `INSERT INTO agent_notifications (agent_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [agentId, type, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (err) {
    console.error('[AgentNotification] Failed to create notification:', err.message);
  }
}

// ── GET /api/agents/me/notifications ─────────────────────────
async function getAgentNotifications(req, res) {
  const agentId = req.agent.id;
  try {
    const { rows } = await db.query(
      `SELECT * FROM agent_notifications
        WHERE agent_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [agentId]
    );
    const unread_count = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unread_count });
  } catch (err) {
    console.error('getAgentNotifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/agents/me/notifications/:id/read ─────────────────
async function markAgentNotificationRead(req, res) {
  try {
    await db.query(
      `UPDATE agent_notifications SET is_read = TRUE
        WHERE id = $1 AND agent_id = $2`,
      [req.params.id, req.agent.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('markAgentNotificationRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/agents/me/notifications/read-all ─────────────────
async function markAllAgentNotificationsRead(req, res) {
  try {
    await db.query(
      `UPDATE agent_notifications SET is_read = TRUE WHERE agent_id = $1`,
      [req.agent.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('markAllAgentNotificationsRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Admin notification types ──────────────────────────────────
const ADMIN_TYPES = {
  SHOP_ONBOARDED:      'shop_onboarded',
  PAYMENT_SUBMITTED:   'payment_submitted',
  PAYMENT_SUSPICIOUS:  'payment_suspicious',
  AGENT_RESTRICTED:    'agent_restricted',
};

// ── Internal helper: create admin notification ────────────────
async function createAdminNotification(type, title, message, priority = 'normal', data = null) {
  try {
    await db.query(
      `INSERT INTO admin_notifications (type, priority, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, priority, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (err) {
    console.error('[AdminNotification] Failed to create notification:', err.message);
  }
}

// ── GET /api/admin/notifications ─────────────────────────────
async function getAdminNotifications(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM admin_notifications
        ORDER BY created_at DESC
        LIMIT 80`
    );
    const unread_count = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unread_count });
  } catch (err) {
    console.error('getAdminNotifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/notifications/:id/read ────────────────────
async function markAdminNotificationRead(req, res) {
  try {
    await db.query(
      `UPDATE admin_notifications SET is_read = TRUE WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('markAdminNotificationRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── PUT /api/admin/notifications/read-all ────────────────────
async function markAllAdminNotificationsRead(req, res) {
  try {
    await db.query(`UPDATE admin_notifications SET is_read = TRUE WHERE is_read = FALSE`);
    res.json({ ok: true });
  } catch (err) {
    console.error('markAllAdminNotificationsRead error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getNotifications, markRead, markAllRead,
  createNotification, runDailyChecks, TYPES,
  createAgentNotification, AGENT_TYPES,
  getAgentNotifications, markAgentNotificationRead, markAllAgentNotificationsRead,
  createAdminNotification, ADMIN_TYPES,
  getAdminNotifications, markAdminNotificationRead, markAllAdminNotificationsRead,
};
