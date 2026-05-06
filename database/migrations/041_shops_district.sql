-- Add district column to shops table
-- Fixes getShopsByAgent and getShopsMapData queries that reference s.district

ALTER TABLE shops ADD COLUMN IF NOT EXISTS district VARCHAR(100);
