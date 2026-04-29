-- 026_agent_notifications.sql
-- Agent-specific notification table for commission and payment events.

CREATE TABLE IF NOT EXISTS agent_notifications (
  id         SERIAL      PRIMARY KEY,
  agent_id   INTEGER     NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
  type       VARCHAR(80) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT        NOT NULL,
  data       JSONB,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_notifications_agent_idx
  ON agent_notifications (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_notifications_unread_idx
  ON agent_notifications (agent_id, is_read)
  WHERE is_read = FALSE;
