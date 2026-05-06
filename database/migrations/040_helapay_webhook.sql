-- Migration 040: HelaPlay webhook support + schema additions
-- Adds missing columns to shops, sales_agents, payments tables;
-- creates webhook_logs (debugging) and user_notifications (unified) tables.

-- ── shops: location / subscription tracking columns ──────────
ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_maps_link      TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS selfie_image_path     VARCHAR(500);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_end_date DATE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_payment_date     DATE;

-- Backfill last_payment_date from the most recent verified shop_payment_proof
UPDATE shops s
   SET last_payment_date = (
     SELECT MAX(spp.created_at)::DATE
       FROM shop_payment_proofs spp
      WHERE spp.shop_id = s.id AND spp.status = 'verified'
   )
 WHERE s.last_payment_date IS NULL;

-- ── sales_agents: account_balance ────────────────────────────
-- Denormalised balance for quick reads; kept in sync by webhook handler.
ALTER TABLE sales_agents
  ADD COLUMN IF NOT EXISTS account_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Sync existing balances from agent_wallet into new column
UPDATE sales_agents sa
   SET account_balance = COALESCE(aw.balance, 0)
  FROM agent_wallet aw
 WHERE aw.agent_id = sa.id;

-- ── payments: agent link + transaction tracking ───────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS agent_id           INT REFERENCES sales_agents(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id     VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS helapay_reference  VARCHAR(100);
-- payment_method was not in the original schema — add it with sensible default
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method     VARCHAR(30) NOT NULL DEFAULT 'bank_transfer';

-- Add check constraint (safe to drop-and-recreate; column now guaranteed to exist)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('qr','cash','card','mobile','other','helapay','bank_transfer'));

CREATE INDEX IF NOT EXISTS idx_payments_agent_id          ON payments(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id    ON payments(transaction_id) WHERE transaction_id IS NOT NULL;
-- Partial unique index: prevents double-recording the same HelaPlay transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_helapay_reference_unique
  ON payments(helapay_reference) WHERE helapay_reference IS NOT NULL;

-- ── webhook_logs: full audit trail of every inbound webhook ──
CREATE TABLE IF NOT EXISTS webhook_logs (
  id             SERIAL PRIMARY KEY,
  source         VARCHAR(50)  NOT NULL DEFAULT 'helapay',   -- 'helapay' | 'helapos' | etc.
  reference      VARCHAR(200),
  transaction_id VARCHAR(200),
  payload        JSONB        NOT NULL DEFAULT '{}',
  headers        JSONB        NOT NULL DEFAULT '{}',
  status         VARCHAR(20)  NOT NULL DEFAULT 'received',  -- received | processed | failed | duplicate
  error_message  TEXT,
  session_type   VARCHAR(30),  -- billing | agent_deposit | pos | unknown
  resolved_id    INT,          -- FK to qr_payment_sessions.id if matched
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference      ON webhook_logs(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_transaction_id ON webhook_logs(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at     ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status         ON webhook_logs(status, created_at DESC);

-- ── user_notifications: unified notification table ────────────
-- Covers shop users, agents, and admin in one table for cross-cutting queries.
-- The per-entity tables (notifications, agent_notifications, admin_notifications)
-- continue to be the primary read path; this table supplements them.
CREATE TABLE IF NOT EXISTS user_notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT          NOT NULL,            -- shop_id, agent id, or 0 for admin
  user_type  VARCHAR(20)  NOT NULL             -- 'shop' | 'agent' | 'admin'
             CHECK (user_type IN ('shop','agent','admin')),
  type       VARCHAR(80)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  data       JSONB,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_user   ON user_notifications(user_type, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notif_unread ON user_notifications(user_type, user_id, is_read)
  WHERE is_read = FALSE;
