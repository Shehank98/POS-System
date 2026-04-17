-- ============================================================
-- Migration 012: Clothing Module
-- Adds clothing shop type with product variants, exchanges,
-- and per-variant stock tracking.
-- ============================================================

-- Extend shop_type to include 'clothing'
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_shop_type_check;
ALTER TABLE shops ADD CONSTRAINT shops_shop_type_check
  CHECK (shop_type IN ('retail','car_wash','clothing'));

-- ============================================================
-- CLOTHING PRODUCTS  (parent-level, e.g. "T-Shirt")
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_products (
  id            SERIAL PRIMARY KEY,
  shop_id       INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(100),
  base_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  is_clearance  BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLOTHING VARIANTS  (one row per product × size × color)
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_variants (
  id                  SERIAL PRIMARY KEY,
  shop_id             INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL REFERENCES clothing_products(id) ON DELETE CASCADE,
  size                VARCHAR(20) NOT NULL,
  color               VARCHAR(50) NOT NULL,
  sku                 VARCHAR(100),
  barcode             VARCHAR(100),
  price_override      NUMERIC(12,2),          -- NULL = use parent base_price
  stock_quantity      INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, barcode),
  UNIQUE (shop_id, product_id, size, color)
);

-- ============================================================
-- CLOTHING STOCK ADJUSTMENTS  (audit trail for all stock changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_stock_adjustments (
  id           SERIAL PRIMARY KEY,
  shop_id      INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  variant_id   INTEGER NOT NULL REFERENCES clothing_variants(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  delta        INTEGER NOT NULL,    -- positive = stock in, negative = out
  reason       VARCHAR(50) NOT NULL DEFAULT 'manual',
                                    -- sale / return / exchange / received / damaged / lost / correction / manual
  reference_id INTEGER,             -- transaction_id or exchange_id for traceability
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLOTHING EXCHANGES  (return + issue in one atomic operation)
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_exchanges (
  id                      SERIAL PRIMARY KEY,
  shop_id                 INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  exchange_number         VARCHAR(50) NOT NULL,
  customer_phone          VARCHAR(20),
  status                  VARCHAR(20) NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('completed','cancelled')),
  net_refund_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, exchange_number)
);

-- ============================================================
-- CLOTHING EXCHANGE ITEMS  (what was returned and issued)
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_exchange_items (
  id          SERIAL PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES clothing_exchanges(id) ON DELETE CASCADE,
  direction   VARCHAR(10) NOT NULL CHECK (direction IN ('returned','issued')),
  variant_id  INTEGER NOT NULL REFERENCES clothing_variants(id),
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- EXTEND transaction_items: link to clothing variant
-- ============================================================
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS clothing_variant_id INTEGER
    REFERENCES clothing_variants(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clp_shop        ON clothing_products(shop_id);
CREATE INDEX IF NOT EXISTS idx_clp_category    ON clothing_products(shop_id, category);
CREATE INDEX IF NOT EXISTS idx_clv_shop        ON clothing_variants(shop_id);
CREATE INDEX IF NOT EXISTS idx_clv_product     ON clothing_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_clv_barcode     ON clothing_variants(shop_id, barcode);
CREATE INDEX IF NOT EXISTS idx_clsa_variant    ON clothing_stock_adjustments(variant_id);
CREATE INDEX IF NOT EXISTS idx_clsa_shop_date  ON clothing_stock_adjustments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clex_shop       ON clothing_exchanges(shop_id);
CREATE INDEX IF NOT EXISTS idx_clex_txn        ON clothing_exchanges(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_clex_phone      ON clothing_exchanges(customer_phone);
CREATE INDEX IF NOT EXISTS idx_ti_clv          ON transaction_items(clothing_variant_id)
  WHERE clothing_variant_id IS NOT NULL;
