-- Migration 020: Car Service module product flag
-- Allows admin to toggle Products tab visibility for car service shops.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS car_service_products_enabled BOOLEAN NOT NULL DEFAULT TRUE;
