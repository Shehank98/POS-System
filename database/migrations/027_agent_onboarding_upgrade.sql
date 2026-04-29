-- Migration 027: Agent onboarding upgrade
-- Adds subscription plan selection, expected amount tracking,
-- suspicious payment detection, and agent wallet ledger.

-- ── Extend subscription_status CHECK to include pending_payment ──
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_subscription_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check
  CHECK (subscription_status IN ('trial','active','expired','suspended','pending_payment'));

-- ── New shops columns ─────────────────────────────────────────
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_id             INT          REFERENCES subscription_plans(id);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_months INT          NOT NULL DEFAULT 1;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS expected_amount     NUMERIC(10,2);

-- barcode_enabled may already exist (schema.sql) — add safely
ALTER TABLE shops ADD COLUMN IF NOT EXISTS barcode_enabled     BOOLEAN      NOT NULL DEFAULT FALSE;

-- ── New agent_payment_submissions columns ─────────────────────
ALTER TABLE agent_payment_submissions ADD COLUMN IF NOT EXISTS expected_amount  NUMERIC(10,2);
ALTER TABLE agent_payment_submissions ADD COLUMN IF NOT EXISTS submitted_amount NUMERIC(10,2);
ALTER TABLE agent_payment_submissions ADD COLUMN IF NOT EXISTS proof_url        TEXT;
ALTER TABLE agent_payment_submissions ADD COLUMN IF NOT EXISTS is_suspicious    BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Agent wallet ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_wallet (
  agent_id        INT          PRIMARY KEY REFERENCES sales_agents(id) ON DELETE CASCADE,
  total_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_verified  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Back-fill wallet rows for existing agents
INSERT INTO agent_wallet (agent_id)
  SELECT id FROM sales_agents
  ON CONFLICT (agent_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_shops_plan_id     ON shops(plan_id);
CREATE INDEX IF NOT EXISTS idx_shops_sub_status  ON shops(subscription_status);
