-- ============================================================
-- Migration 014: Multi-Store Branch Support
-- Enables a single clothing shop account to manage multiple
-- physical branch locations with per-branch inventory.
-- ============================================================

-- ============================================================
-- STORE BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS store_branches (
  id         SERIAL PRIMARY KEY,
  shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  address    TEXT,
  phone      VARCHAR(20),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BRANCH INVENTORY  (variant stock per branch)
-- NULL branch_id = default/global stock (clothing_variants.stock_quantity)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_inventory (
  id                  SERIAL PRIMARY KEY,
  branch_id           INTEGER NOT NULL REFERENCES store_branches(id) ON DELETE CASCADE,
  variant_id          INTEGER NOT NULL REFERENCES clothing_variants(id) ON DELETE CASCADE,
  stock_quantity      INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  UNIQUE (branch_id, variant_id)
);

-- ============================================================
-- EXTEND users + transactions: optional branch assignment
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES store_branches(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES store_branches(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_branches_shop       ON store_branches(shop_id);
CREATE INDEX IF NOT EXISTS idx_branch_inv_branch   ON branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inv_variant  ON branch_inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_txn_branch          ON transactions(branch_id)
  WHERE branch_id IS NOT NULL;
