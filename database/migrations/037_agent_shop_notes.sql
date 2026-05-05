-- Agent follow-up notes per shop (per-agent, per-shop)
CREATE TABLE IF NOT EXISTS agent_shop_notes (
  id         SERIAL PRIMARY KEY,
  agent_id   INT NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
  shop_id    INT NOT NULL REFERENCES shops(id)        ON DELETE CASCADE,
  note       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, shop_id)
);
