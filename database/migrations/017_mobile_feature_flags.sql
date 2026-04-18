-- Migration 017: Additional feature flags for mobile app feature-gating
-- All columns DEFAULT TRUE so existing shops are unaffected on upgrade.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS pos_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS products_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifications_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS inventory_enabled      BOOLEAN NOT NULL DEFAULT TRUE;
