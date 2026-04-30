-- 031_subscription_billing_fixes.sql
-- Prevents double-approval for the same shop in the same billing month
-- and adds a billing_month column so the UI can display per-period data clearly.

-- Billing month for each agent payment submission (first day of the payment month)
ALTER TABLE agent_payment_submissions
  ADD COLUMN IF NOT EXISTS billing_month DATE
    GENERATED ALWAYS AS (DATE_TRUNC('month', payment_date)::DATE) STORED;

-- Unique: one verified payment per shop per calendar month
-- Allows multiple pending/rejected, but only one verified per period.
CREATE UNIQUE INDEX IF NOT EXISTS idx_aps_one_verified_per_month
  ON agent_payment_submissions (shop_id, billing_month)
  WHERE status = 'verified';

-- Index for fast per-month lookups
CREATE INDEX IF NOT EXISTS idx_aps_billing_month
  ON agent_payment_submissions (billing_month DESC);
