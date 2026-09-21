const { neon } = require('@neondatabase/serverless');

let schemaReady = false;
let schemaPromise = null;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || null;
}

function createSqlClient(connectionString) {
  return neon(connectionString);
}

async function ensureSchema(sql) {
  if (schemaReady) {
    return;
  }
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS watchlist_tokens (
          token VARCHAR(32) PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS alert_conditions (
          id UUID PRIMARY KEY,
          token VARCHAR(32) NOT NULL,
          timeframe VARCHAR(8) NOT NULL,
          op VARCHAR(4) NOT NULL,
          threshold DOUBLE PRECISION NOT NULL,
          last_fired_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT alert_conditions_op_check CHECK (op IN ('<', '<=', '>', '>='))
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_alert_conditions_token_timeframe
        ON alert_conditions (token, timeframe)
      `;
      await sql`
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
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_strategy_events_token_timeframe_created
        ON strategy_events (token, timeframe, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS strategy_signal_state (
          token VARCHAR(32) NOT NULL,
          timeframe VARCHAR(8) NOT NULL,
          side VARCHAR(4) NOT NULL,
          active BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (token, timeframe, side),
          CONSTRAINT strategy_signal_state_side_check CHECK (side IN ('buy', 'sell'))
        )
      `;
      schemaReady = true;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  try {
    await schemaPromise;
  } catch (err) {
    schemaPromise = null;
    throw err;
  }
}

module.exports = {
  resolveDatabaseUrl,
  createSqlClient,
  ensureSchema,
};
