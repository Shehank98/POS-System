-- 029_admin_notifications.sql
-- Admin-specific notification table for shop onboarding, payment, and fraud events.

CREATE TABLE IF NOT EXISTS admin_notifications (
  id         SERIAL       PRIMARY KEY,
  type       VARCHAR(80)  NOT NULL,
  priority   VARCHAR(20)  NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  data       JSONB,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_notifications_unread_idx
  ON admin_notifications (created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS admin_notifications_created_idx
  ON admin_notifications (created_at DESC);
