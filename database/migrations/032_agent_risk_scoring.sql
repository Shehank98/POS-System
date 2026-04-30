-- 032_agent_risk_scoring.sql
-- Agent risk score table for fraud prevention and auto-restriction.

CREATE TABLE IF NOT EXISTS agent_risk_scores (
  id                       SERIAL      PRIMARY KEY,
  agent_id                 INTEGER     UNIQUE NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
  risk_score               INTEGER     NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level               VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),

  -- Component counters driving the score
  payment_mismatches_count INTEGER     NOT NULL DEFAULT 0,
  partial_payments_count   INTEGER     NOT NULL DEFAULT 0,
  rejected_payments_count  INTEGER     NOT NULL DEFAULT 0,
  fraud_flags_count        INTEGER     NOT NULL DEFAULT 0,

  -- Restriction state
  is_restricted            BOOLEAN     NOT NULL DEFAULT FALSE,
  restriction_reason       TEXT,
  requires_admin_approval  BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Bookkeeping
  last_calculated_at       TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a risk score row exists for every agent
INSERT INTO agent_risk_scores (agent_id)
  SELECT id FROM sales_agents
  ON CONFLICT (agent_id) DO NOTHING;

-- Fast lookup for risky agents
CREATE INDEX IF NOT EXISTS idx_risk_score_level
  ON agent_risk_scores (risk_level, risk_score DESC)
  WHERE risk_level != 'low';
