-- Migration 033: Agent self-registration + shop onboarding upgrade
-- Adds: agent document uploads, approval workflow, invite tokens,
--        shop location fields, shop reference IDs, shop payment proofs

-- ── Extend sales_agents ───────────────────────────────────────
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS nic_number               VARCHAR(20);
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS driving_license_number   VARCHAR(30);
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS nic_front_url            TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS nic_back_url             TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS agent_photo_url          TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS bank_book_url            TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS signed_agreement_url     TEXT;
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS agreement_generated_at   TIMESTAMPTZ;
-- approval_status: pending | active | rejected  (existing agents default to 'active')
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS approval_status   VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE sales_agents ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;

-- Constrain valid values
ALTER TABLE sales_agents DROP CONSTRAINT IF EXISTS sales_agents_approval_status_check;
ALTER TABLE sales_agents ADD CONSTRAINT sales_agents_approval_status_check
  CHECK (approval_status IN ('pending','active','rejected'));

-- ── Agent registration invite tokens ─────────────────────────
-- Token generated in application layer (see adminAgentController.generateInviteToken)
CREATE TABLE IF NOT EXISTS agent_registration_tokens (
  id         SERIAL PRIMARY KEY,
  token      VARCHAR(64) NOT NULL UNIQUE,
  note       TEXT,
  used_at    TIMESTAMPTZ,
  used_by    INT REFERENCES sales_agents(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reg_tokens_token ON agent_registration_tokens(token);

-- ── Extend shops with location + identity fields ──────────────
ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_number    VARCHAR(20);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location_lat      DECIMAL(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location_lng      DECIMAL(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location_map_url  TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS br_number         VARCHAR(50);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_reference_id VARCHAR(20) UNIQUE;
-- activation_status: inactive | active  (existing shops default to 'active')
ALTER TABLE shops ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_activation_status_check;
ALTER TABLE shops ADD CONSTRAINT shops_activation_status_check
  CHECK (activation_status IN ('inactive','active'));

-- Back-fill shop_reference_id for existing shops that don't have one
UPDATE shops
   SET shop_reference_id = 'SHP-' || LPAD(id::text, 6, '0')
 WHERE shop_reference_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_shops_reference_id    ON shops(shop_reference_id);
CREATE INDEX IF NOT EXISTS idx_shops_activation      ON shops(activation_status);

-- ── Shop payment proofs ───────────────────────────────────────
-- Tracks LKR 2500/month payments submitted by shop owners or agents
CREATE TABLE IF NOT EXISTS shop_payment_proofs (
  id              SERIAL PRIMARY KEY,
  shop_id         INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  agent_id        INT REFERENCES sales_agents(id),
  amount          NUMERIC(10,2) NOT NULL DEFAULT 2500.00,
  payment_method  VARCHAR(30)   NOT NULL DEFAULT 'bank_transfer',
                  -- 'bank_transfer' = shop owner uploads proof
                  -- 'agent_helaPay' = agent pays via HelaPay QR
  proof_url       TEXT,
  qr_reference    VARCHAR(100),
  month_paid_for  DATE,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE shop_payment_proofs DROP CONSTRAINT IF EXISTS shop_payment_proofs_method_check;
ALTER TABLE shop_payment_proofs ADD CONSTRAINT shop_payment_proofs_method_check
  CHECK (payment_method IN ('bank_transfer','agent_helaPay'));

ALTER TABLE shop_payment_proofs DROP CONSTRAINT IF EXISTS shop_payment_proofs_status_check;
ALTER TABLE shop_payment_proofs ADD CONSTRAINT shop_payment_proofs_status_check
  CHECK (status IN ('pending','verified','rejected'));

CREATE INDEX IF NOT EXISTS idx_shop_payment_proofs_shop   ON shop_payment_proofs(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_payment_proofs_agent  ON shop_payment_proofs(agent_id);
CREATE INDEX IF NOT EXISTS idx_shop_payment_proofs_status ON shop_payment_proofs(status);
