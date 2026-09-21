-- Neon Postgres schema for watchlist and alert persistence.
-- Applied automatically at runtime via lib/db.js ensureSchema(); run manually if preferred.

CREATE TABLE IF NOT EXISTS watchlist_tokens (
  token VARCHAR(32) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_conditions (
  id UUID PRIMARY KEY,
  token VARCHAR(32) NOT NULL,
  timeframe VARCHAR(8) NOT NULL,
  op VARCHAR(4) NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_conditions_op_check CHECK (op IN ('<', '<=', '>', '>='))
);

CREATE INDEX IF NOT EXISTS idx_alert_conditions_token_timeframe
  ON alert_conditions (token, timeframe);
