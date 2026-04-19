-- Per-shop HelaPOS credentials + cached tokens
CREATE TABLE IF NOT EXISTS shop_helapos_config (
  shop_id          INTEGER PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  app_id           TEXT NOT NULL,
  app_secret       TEXT NOT NULL,
  business_id      TEXT NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active QR payment sessions (one per sale/pre-order attempt)
CREATE TABLE IF NOT EXISTS qr_payment_sessions (
  id             SERIAL PRIMARY KEY,
  shop_id        INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  reference      TEXT NOT NULL,
  qr_reference   TEXT,
  qr_data        TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  payment_status INTEGER NOT NULL DEFAULT 0,
  session_type   TEXT NOT NULL DEFAULT 'pos',
  pre_order_id   INTEGER REFERENCES pre_orders(id),
  transaction_id INTEGER,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_sessions_reference    ON qr_payment_sessions(reference);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_qr_reference ON qr_payment_sessions(qr_reference);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_shop_id      ON qr_payment_sessions(shop_id, created_at DESC);

-- Add 'qr' to existing payment_method constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('cash','card','mobile','other','qr'));
