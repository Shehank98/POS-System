-- 028_soft_delete_shops.sql
-- Add soft-delete columns to shops table so shops can be marked as deleted
-- without immediately breaking foreign key relationships.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  VARCHAR(100);

CREATE INDEX IF NOT EXISTS shops_not_deleted_idx
  ON shops (id)
  WHERE is_deleted = FALSE;
