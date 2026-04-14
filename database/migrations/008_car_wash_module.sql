-- ============================================================
-- Migration 008: Car Wash Module
-- Adds shop_type to shops and all car-wash-specific tables
-- ============================================================

-- Add shop_type to the shops table (default 'retail' keeps existing shops unchanged)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_type VARCHAR(50) NOT NULL DEFAULT 'retail';

-- ============================================================
-- CAR WASH SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_services (
  id               SERIAL PRIMARY KEY,
  shop_id          INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH PRODUCTS / ADD-ONS  (with stock tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_products (
  id             SERIAL PRIMARY KEY,
  shop_id        INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  unit           VARCHAR(50) DEFAULT 'pcs',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH JOBS  (central entity — one row per vehicle visit)
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_jobs (
  id                SERIAL PRIMARY KEY,
  shop_id           INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  vehicle_number    VARCHAR(100),
  vehicle_type      VARCHAR(100),
  phone_number      VARCHAR(50),
  customer_name     VARCHAR(255),
  status            VARCHAR(30) NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','in_progress','completed','paid')),
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id        INTEGER,           -- FK set after carwash_bookings table is created
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH JOB ITEMS  (services + products used on a job)
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_job_items (
  id         SERIAL PRIMARY KEY,
  job_id     INTEGER NOT NULL REFERENCES carwash_jobs(id) ON DELETE CASCADE,
  item_type  VARCHAR(20) NOT NULL CHECK (item_type IN ('service','product')),
  item_id    INTEGER NOT NULL,
  item_name  VARCHAR(255) NOT NULL,
  quantity   NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal   NUMERIC(12,2) NOT NULL DEFAULT 0,
  added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CAR WASH BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_bookings (
  id                SERIAL PRIMARY KEY,
  shop_id           INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  vehicle_number    VARCHAR(100),
  phone_number      VARCHAR(50),
  customer_name     VARCHAR(255),
  service_id        INTEGER REFERENCES carwash_services(id) ON DELETE SET NULL,
  booking_date      DATE NOT NULL,
  time_slot         VARCHAR(20) NOT NULL,
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked','arrived','converted_to_job','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from carwash_jobs.booking_id → carwash_bookings now that the table exists
ALTER TABLE carwash_jobs
  ADD CONSTRAINT fk_carwash_jobs_booking
  FOREIGN KEY (booking_id) REFERENCES carwash_bookings(id) ON DELETE SET NULL;

-- ============================================================
-- CAR WASH PAYMENTS  (one payment record per job)
-- ============================================================
CREATE TABLE IF NOT EXISTS carwash_payments (
  id             SERIAL PRIMARY KEY,
  job_id         INTEGER NOT NULL REFERENCES carwash_jobs(id) ON DELETE CASCADE,
  shop_id        INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash','card','digital')),
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cw_services_shop    ON carwash_services(shop_id);
CREATE INDEX IF NOT EXISTS idx_cw_products_shop    ON carwash_products(shop_id);
CREATE INDEX IF NOT EXISTS idx_cw_jobs_shop        ON carwash_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_cw_jobs_status      ON carwash_jobs(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_cw_jobs_phone       ON carwash_jobs(phone_number);
CREATE INDEX IF NOT EXISTS idx_cw_jobs_vehicle     ON carwash_jobs(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_cw_job_items_job    ON carwash_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_cw_bookings_shop    ON carwash_bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_cw_bookings_date    ON carwash_bookings(shop_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_cw_payments_job     ON carwash_payments(job_id);
