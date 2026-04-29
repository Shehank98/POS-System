CREATE TABLE IF NOT EXISTS sales_agents (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(150) NOT NULL UNIQUE,
  phone            VARCHAR(20),
  password_hash    VARCHAR(255) NOT NULL,
  district         VARCHAR(100),
  monthly_target   INT NOT NULL DEFAULT 0,
  bank_name        VARCHAR(100),
  bank_account     VARCHAR(50),
  bank_branch      VARCHAR(100),
  account_holder   VARCHAR(100),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shops ADD COLUMN IF NOT EXISTS onboarded_by_agent_id INT REFERENCES sales_agents(id);

CREATE TABLE IF NOT EXISTS agent_payment_submissions (
  id               SERIAL PRIMARY KEY,
  agent_id         INT NOT NULL REFERENCES sales_agents(id),
  shop_id          INT NOT NULL REFERENCES shops(id),
  amount           NUMERIC(10,2) NOT NULL,
  payment_method   VARCHAR(20) NOT NULL DEFAULT 'cash',
  payment_date     DATE NOT NULL,
  notes            TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
  admin_note       TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_commissions (
  id                    SERIAL PRIMARY KEY,
  agent_id              INT NOT NULL REFERENCES sales_agents(id),
  shop_id               INT NOT NULL REFERENCES shops(id),
  commission_type       VARCHAR(20) NOT NULL,
  amount                NUMERIC(10,2) NOT NULL DEFAULT 500,
  month                 DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'locked',
  payment_submission_id INT REFERENCES agent_payment_submissions(id),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_payout_logs (
  id               SERIAL PRIMARY KEY,
  agent_id         INT NOT NULL REFERENCES sales_agents(id),
  amount           NUMERIC(10,2) NOT NULL,
  commission_ids   INT[] NOT NULL DEFAULT '{}',
  notes            TEXT,
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_payments_agent_status  ON agent_payment_submissions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent      ON agent_commissions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_shops_agent_id               ON shops(onboarded_by_agent_id);
