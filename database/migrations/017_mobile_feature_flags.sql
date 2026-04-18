-- Migration 017: Remove incorrectly added columns not managed by admin panel.
-- The correct feature flags (migration 016) already cover everything the admin
-- panel controls. These 4 columns were added in error and must be dropped.

ALTER TABLE shops
  DROP COLUMN IF EXISTS pos_enabled,
  DROP COLUMN IF EXISTS products_enabled,
  DROP COLUMN IF EXISTS notifications_enabled,
  DROP COLUMN IF EXISTS inventory_enabled;
