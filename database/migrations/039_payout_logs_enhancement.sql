-- Enhance agent_payout_logs with payment details
ALTER TABLE agent_payout_logs
  ADD COLUMN IF NOT EXISTS payment_method       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_date         DATE;

-- Add approved_by_admin tracking to agent_commissions
ALTER TABLE agent_commissions
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Backfill approved_at from paid_at for existing approved/paid rows
UPDATE agent_commissions
   SET approved_at = COALESCE(paid_at, created_at)
 WHERE status IN ('approved', 'paid') AND approved_at IS NULL;
