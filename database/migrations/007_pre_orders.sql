-- Migration 007: Pre-Orders table for QR Scan & Pre-Order System
-- Creates pre_orders table with token-based ordering and status tracking

CREATE TABLE IF NOT EXISTS pre_orders (
  id              SERIAL PRIMARY KEY,
  shop_id         INTEGER NOT NULL REFERENCES shops(id),
  customer_phone  VARCHAR(20) NOT NULL,
  customer_name   VARCHAR(100),
  items           JSONB NOT NULL,
  total_amount    DECIMAL(10,2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  token_number    VARCHAR(10) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_orders_shop_id     ON pre_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_pre_orders_shop_status ON pre_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_shop_date   ON pre_orders(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pre_orders_token       ON pre_orders(shop_id, token_number);
