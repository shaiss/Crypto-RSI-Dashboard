-- Paper strategy signal events (no trade execution).

CREATE TABLE IF NOT EXISTS strategy_events (
  id UUID PRIMARY KEY,
  token VARCHAR(32) NOT NULL,
  timeframe VARCHAR(8) NOT NULL,
  side VARCHAR(4) NOT NULL,
  rsi DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  wallet_address VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT strategy_events_side_check CHECK (side IN ('buy', 'sell'))
);

CREATE INDEX IF NOT EXISTS idx_strategy_events_token_timeframe_created
  ON strategy_events (token, timeframe, created_at DESC);

CREATE TABLE IF NOT EXISTS strategy_signal_state (
  token VARCHAR(32) NOT NULL,
  timeframe VARCHAR(8) NOT NULL,
  side VARCHAR(4) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token, timeframe, side),
  CONSTRAINT strategy_signal_state_side_check CHECK (side IN ('buy', 'sell'))
);
