-- Migration 006: Add all columns that may be missing from older database instances
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO-NOTHING guards).
-- Run this in your Railway → Data → Query tab if you get "server error" when
-- creating shops or updating shop details.

-- ── From migration 001 ────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_client_id
  ON transactions(client_id)
  WHERE client_id IS NOT NULL;

-- ── From migration 002 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    data       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_shop_id ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(shop_id, is_read) WHERE is_read = FALSE;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── From migration 003 ────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS refund_of INTEGER REFERENCES transactions(id) ON DELETE SET NULL;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transactions_refund_of ON transactions(refund_of)
  WHERE refund_of IS NOT NULL;

-- ── From migration 004 ────────────────────────────────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS extra_staff_slots INTEGER DEFAULT 0;

-- ── From migration 005 ────────────────────────────────────────
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
