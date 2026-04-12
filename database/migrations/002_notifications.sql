-- Migration 002: Notifications table + payment notes
-- Run this on your Railway PostgreSQL database

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    data       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_shop_id ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(shop_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- Add notes column to payments (for admin rejection reason)
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
