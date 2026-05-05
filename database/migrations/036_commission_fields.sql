-- ── Commission table: add missing columns ────────────────────

ALTER TABLE agent_commissions
  ADD COLUMN IF NOT EXISTS earned_date          DATE,
  ADD COLUMN IF NOT EXISTS payment_method       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- Backfill earned_date from created_at for existing rows
UPDATE agent_commissions
   SET earned_date = created_at::DATE
 WHERE earned_date IS NULL;

-- ── Normalise status: 'locked' → 'pending' ───────────────────
-- 'locked' was used to mean "commission earned but shop not yet activated".
-- The cleaner term going forward is 'pending'.
UPDATE agent_commissions SET status = 'pending' WHERE status = 'locked';

-- ── Normalise commission_type naming ─────────────────────────
-- 'signup'    → 'onboarding'  (first activation commission)
-- 'recurring' → 'monthly'     (per-subscription-payment commission)
UPDATE agent_commissions SET commission_type = 'onboarding' WHERE commission_type = 'signup';
UPDATE agent_commissions SET commission_type = 'monthly'    WHERE commission_type = 'recurring';

-- ── Unique index: prevents duplicate monthly commissions ─────
-- Ensures only one commission row per (agent, shop, type, month).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_commissions_unique_month
  ON agent_commissions (agent_id, shop_id, commission_type, month)
  WHERE month IS NOT NULL;

-- ── Index: earned_date for date-range queries ─────────────────
CREATE INDEX IF NOT EXISTS idx_agent_commissions_earned_date
  ON agent_commissions (agent_id, earned_date DESC);
