-- Migration 001: Add client_id to transactions for offline sync deduplication
-- Run once against your production database.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(64);

-- Unique per shop so the same client UUID can't create two transactions
-- for different shops (edge case), but duplicate syncs are safely ignored.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_client_id
  ON transactions(client_id)
  WHERE client_id IS NOT NULL;
