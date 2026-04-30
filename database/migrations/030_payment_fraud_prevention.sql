-- 030_payment_fraud_prevention.sql
-- Enhances agent_payment_submissions with detailed payment status classification
-- and adds agent_payment_flags for fraud audit trail.

-- Detailed status for each submission: full / partial / overpayment / mismatch
ALTER TABLE agent_payment_submissions
  ADD COLUMN IF NOT EXISTS payment_detail_status VARCHAR(20)
    CHECK (payment_detail_status IN ('full','partial','overpayment','mismatch'));

-- Flag reason text (mirrors is_suspicious but descriptive)
ALTER TABLE agent_payment_submissions
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Convenience: shortage amount (expected - submitted) for partial payments
ALTER TABLE agent_payment_submissions
  ADD COLUMN IF NOT EXISTS shortage_amount NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN expected_amount IS NOT NULL AND submitted_amount < expected_amount
      THEN expected_amount - submitted_amount
      ELSE 0
    END
  ) STORED;

-- Fast lookup: all suspicious / flagged submissions
CREATE INDEX IF NOT EXISTS idx_aps_flagged
  ON agent_payment_submissions (agent_id, is_suspicious)
  WHERE is_suspicious = TRUE;

-- Agent payment flags – immutable fraud audit log
CREATE TABLE IF NOT EXISTS agent_payment_flags (
  id            SERIAL      PRIMARY KEY,
  agent_id      INTEGER     NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
  submission_id INTEGER     REFERENCES agent_payment_submissions(id),
  flag_type     VARCHAR(50) NOT NULL CHECK (flag_type IN ('partial','mismatch','overpayment','repeated_partial','auto_restricted')),
  description   TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_flags_agent
  ON agent_payment_flags (agent_id, created_at DESC);
