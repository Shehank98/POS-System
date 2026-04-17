-- Refund vouchers issued on exchange when customer is owed money.
-- Cashier scans barcode at POS to apply as discount; expires after 10 days.
CREATE TABLE IF NOT EXISTS clothing_refund_vouchers (
  id             SERIAL PRIMARY KEY,
  shop_id        INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  exchange_id    INTEGER NOT NULL REFERENCES clothing_exchanges(id) ON DELETE CASCADE,
  voucher_code   VARCHAR(100) NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 days',
  used_at        TIMESTAMPTZ,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, voucher_code)
);

CREATE INDEX IF NOT EXISTS idx_crv_code    ON clothing_refund_vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_crv_shop    ON clothing_refund_vouchers(shop_id);
CREATE INDEX IF NOT EXISTS idx_crv_exchange ON clothing_refund_vouchers(exchange_id);
