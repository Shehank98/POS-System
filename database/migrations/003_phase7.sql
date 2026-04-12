-- Migration 003: Phase 7 – Refunds, Tax Settings, Audit Trail
-- Run this on your Railway PostgreSQL database

-- ── Refund tracking ────────────────────────────────────────────
-- Links a refund transaction back to the original sale
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS refund_of INTEGER REFERENCES transactions(id) ON DELETE SET NULL;

-- ── Shop default tax rate ──────────────────────────────────────
-- Pre-fill this rate when creating new products
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Index for refund lookups
CREATE INDEX IF NOT EXISTS idx_transactions_refund_of ON transactions(refund_of)
  WHERE refund_of IS NOT NULL;
