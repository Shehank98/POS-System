-- Multi-Tenant POS SaaS System - PostgreSQL Schema
-- Run this file on your Railway PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SHOPS TABLE (one row per business/tenant)
-- ============================================================
CREATE TABLE shops (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    owner_name      VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(50),
    address         TEXT,
    subscription_status   VARCHAR(20) NOT NULL DEFAULT 'trial'
                          CHECK (subscription_status IN ('trial','active','expired','suspended')),
    subscription_end_date DATE,
    barcode_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Added by migration 003
    default_tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
    -- Added by migration 004
    extra_staff_slots     INTEGER      DEFAULT 0,
    -- Added by migration 005
    logo_url              TEXT,
    contact_email         VARCHAR(255)
);

-- ============================================================
-- USERS TABLE (staff/owner accounts per shop)
-- ============================================================
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    shop_id       INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    username      VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'cashier'
                  CHECK (role IN ('owner','manager','cashier')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, username)
);

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    shop_id         INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    barcode         VARCHAR(100),
    price           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_price      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    has_inventory   BOOLEAN NOT NULL DEFAULT TRUE,
    category        VARCHAR(100),
    tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, barcode)
);

-- ============================================================
-- TRANSACTIONS TABLE (each sale)
-- ============================================================
CREATE TABLE transactions (
    id                 SERIAL PRIMARY KEY,
    shop_id            INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    transaction_number VARCHAR(50) NOT NULL,
    total_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method     VARCHAR(30) NOT NULL DEFAULT 'cash'
                       CHECK (payment_method IN ('cash','card','mobile','other')),
    status             VARCHAR(20) NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('completed','refunded','void')),
    transaction_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, transaction_number)
);

-- ============================================================
-- TRANSACTION ITEMS TABLE (line items per transaction)
-- ============================================================
CREATE TABLE transaction_items (
    id             SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity       NUMERIC(10, 3) NOT NULL DEFAULT 1,
    unit_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal       NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- ============================================================
-- PAYMENTS TABLE (subscription payments from shop owners)
-- ============================================================
CREATE TABLE payments (
    id                  SERIAL PRIMARY KEY,
    shop_id             INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    amount              NUMERIC(12, 2) NOT NULL,
    payment_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_proof       TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','verified','rejected')),
    subscription_months INTEGER NOT NULL DEFAULT 1,
    -- Added by migration 002
    notes               TEXT
);

-- ============================================================
-- DELETED RECORDS TABLE (soft-delete audit trail)
-- ============================================================
CREATE TABLE deleted_records (
    id            SERIAL PRIMARY KEY,
    shop_id       INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    record_type   VARCHAR(50) NOT NULL,
    record_id     INTEGER NOT NULL,
    deleted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deleted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    original_data JSONB NOT NULL
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_users_shop_id          ON users(shop_id);
CREATE INDEX idx_products_shop_id       ON products(shop_id);
CREATE INDEX idx_products_barcode       ON products(barcode);
CREATE INDEX idx_transactions_shop_id   ON transactions(shop_id);
CREATE INDEX idx_transactions_date      ON transactions(transaction_date);
CREATE INDEX idx_transactions_shop_date ON transactions(shop_id, transaction_date DESC);
CREATE INDEX idx_txn_items_txn_id       ON transaction_items(transaction_id);
CREATE INDEX idx_payments_shop_id       ON payments(shop_id);
CREATE INDEX idx_deleted_shop_id        ON deleted_records(shop_id);
