-- Add billing QR session support
-- Links a qr_payment_sessions row back to a shop_payment_proofs row
-- so the webhook can fulfil the billing payment automatically.

ALTER TABLE qr_payment_sessions
  ADD COLUMN IF NOT EXISTS billing_proof_id INT REFERENCES shop_payment_proofs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qr_sessions_billing_proof ON qr_payment_sessions(billing_proof_id)
  WHERE billing_proof_id IS NOT NULL;

-- Allow 'helaPay' as a payment_method on shop_payment_proofs
-- (bank_transfer = owner uploads slip, agent_helaPay = agent pays, helaPay = shop pays via QR)
ALTER TABLE shop_payment_proofs DROP CONSTRAINT IF EXISTS shop_payment_proofs_method_check;
ALTER TABLE shop_payment_proofs ADD CONSTRAINT shop_payment_proofs_method_check
  CHECK (payment_method IN ('bank_transfer', 'agent_helaPay', 'helaPay'));

-- System-level HelaPOS token cache (one row, updated in place)
CREATE TABLE IF NOT EXISTS system_helapos_token (
  id            INT PRIMARY KEY DEFAULT 1,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 1)  -- only one row ever
);
