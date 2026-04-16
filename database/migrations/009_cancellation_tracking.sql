-- Migration 009: Payment status for pre-orders + customer cancellation tracking

-- ── payment_status on pre_orders ─────────────────────────────
ALTER TABLE pre_orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- ── Customer cancellation tracking ───────────────────────────
-- Tracks per-phone cancellation history to enforce cooldown rules:
--   1st cancel  → allowed normally
--   2nd cancel  → warning shown on next order attempt
--   3rd cancel  → 12-hour cooldown applied (cannot place pre-orders)
CREATE TABLE IF NOT EXISTS customer_cancellation_tracking (
  id                   SERIAL PRIMARY KEY,
  shop_id              INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_phone       VARCHAR(20) NOT NULL,
  total_orders         INTEGER      NOT NULL DEFAULT 0,
  total_cancellations  INTEGER      NOT NULL DEFAULT 0,
  last_order_date      TIMESTAMPTZ,
  cooldown_until       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_cct_shop_phone
  ON customer_cancellation_tracking(shop_id, customer_phone);
