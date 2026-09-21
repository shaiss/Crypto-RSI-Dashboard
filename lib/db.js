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
