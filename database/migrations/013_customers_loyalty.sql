-- ============================================================
-- Migration 013: Customers & Loyalty Points
-- Adds full customer profiles with loyalty tracking for
-- clothing shops (and optionally other shop types).
-- ============================================================

-- ============================================================
-- CUSTOMERS  (full profile beyond pre-order phone tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id             SERIAL PRIMARY KEY,
  shop_id        INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone          VARCHAR(20) NOT NULL,
  name           VARCHAR(100),
  email          VARCHAR(100),
  loyalty_points INTEGER      NOT NULL DEFAULT 0,
  total_spent    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, phone)
);

-- ============================================================
-- LOYALTY TRANSACTIONS  (point earn/spend history)
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id             SERIAL PRIMARY KEY,
  shop_id        INTEGER NOT NULL,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  points_change  INTEGER NOT NULL,      -- positive = earned, negative = redeemed
  reason         VARCHAR(50),           -- purchase / redemption / adjustment / exchange
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXTEND transactions: link to customer + track loyalty
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_id           INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_phone        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS loyalty_points_used   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_shop       ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone      ON customers(shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer     ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_shop         ON loyalty_transactions(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_customer         ON transactions(customer_id)
  WHERE customer_id IS NOT NULL;
