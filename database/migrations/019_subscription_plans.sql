CREATE TABLE IF NOT EXISTS subscription_plans (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(50) NOT NULL UNIQUE,
  base_monthly_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_3m         NUMERIC(5,4)  NOT NULL DEFAULT 0.10,
  discount_6m         NUMERIC(5,4)  NOT NULL DEFAULT 0.15,
  discount_12m        NUMERIC(5,4)  NOT NULL DEFAULT 0.20,
  features            JSONB         NOT NULL DEFAULT '[]',
  limits              JSONB         NOT NULL DEFAULT '{}',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order          INT           NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans
  (name, base_monthly_price, discount_3m, discount_6m, discount_12m, features, limits, sort_order)
VALUES
  (
    'Basic', 2000, 0.10, 0.15, 0.20,
    '["POS Core","Products (up to 100)","1 Staff Account","Sales Reports","WhatsApp Receipt"]',
    '{"max_products":100,"max_staff":1}',
    1
  ),
  (
    'Standard', 3500, 0.10, 0.15, 0.20,
    '["Everything in Basic","Products (up to 500)","3 Staff Accounts","Pre-Orders","Customer Insights","Barcode Scanner","Analytics"]',
    '{"max_products":500,"max_staff":3}',
    2
  ),
  (
    'Premium', 6000, 0.10, 0.15, 0.20,
    '["Everything in Standard","Unlimited Products","Unlimited Staff","Loyalty Points","Refunds & Void","Offline Mode","Multi-Branch","Priority Support"]',
    '{"max_products":-1,"max_staff":-1}',
    3
  )
ON CONFLICT (name) DO NOTHING;
