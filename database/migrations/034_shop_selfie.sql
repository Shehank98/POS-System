-- Migration 034: Add selfie_url to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS selfie_url TEXT;
