-- Agent self-payment / deposit feature
-- Agent pays 2500 LKR → account balance credited 500 LKR

-- Allow agent-deposit QR sessions to not have a shop_id
ALTER TABLE qr_payment_sessions ALTER COLUMN shop_id DROP NOT NULL;

-- Link QR session to an agent for agent-deposit sessions
ALTER TABLE qr_payment_sessions
  ADD COLUMN IF NOT EXISTS agent_id INT REFERENCES sales_agents(id) ON DELETE CASCADE;

-- Agent wallet: add spendable balance
ALTER TABLE agent_wallet
  ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Agent self-payment transaction log
CREATE TABLE IF NOT EXISTS agent_self_payments (
  id          SERIAL PRIMARY KEY,
  agent_id    INT NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 2500,
  credited    NUMERIC(10,2) NOT NULL DEFAULT 500,
  reference   TEXT NOT NULL UNIQUE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed | failed
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_self_payments_agent
  ON agent_self_payments (agent_id, created_at DESC);
