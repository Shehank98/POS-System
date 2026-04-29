-- 025_auth_upgrade.sql
-- Add email-based login support (removes need for shop_id at login)
-- and session tracking for security auditing.

-- ── Users: add optional email column ─────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Partial unique index: enforced only for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (LOWER(email))
  WHERE email IS NOT NULL;

-- Backfill owner emails from shops.contact_email first, then shops.email
UPDATE users u
   SET email = s.contact_email
  FROM shops s
 WHERE u.shop_id = s.id
   AND u.role = 'owner'
   AND u.email IS NULL
   AND s.contact_email IS NOT NULL
   AND s.contact_email <> '';

UPDATE users u
   SET email = s.email
  FROM shops s
 WHERE u.shop_id = s.id
   AND u.role = 'owner'
   AND u.email IS NULL
   AND s.email IS NOT NULL
   AND s.email <> '';

-- ── Login sessions table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_sessions (
  id           SERIAL      PRIMARY KEY,
  user_id      INTEGER     NOT NULL,
  role         VARCHAR(50) NOT NULL,
  device_info  TEXT,
  ip_address   VARCHAR(45),
  jwt_iat      BIGINT,
  last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS login_sessions_user_idx
  ON login_sessions (user_id, role);

CREATE INDEX IF NOT EXISTS login_sessions_active_idx
  ON login_sessions (is_active)
  WHERE is_active = TRUE;
