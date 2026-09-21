const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createSqlClient, ensureSchema } = require('./db');
const { shouldUseFilePersistence, requireDatabaseUrl } = require('./persistence');
const { evaluateStrategyTransitions } = require('./strategySignals');
const { normalizeToken } = require('./watchlist');
const { ALLOWED_TIMEFRAMES } = require('./constants');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'strategy-events.json');

function stateKey(token, timeframe, side) {
  return `${normalizeToken(token)}|${timeframe}|${side}`;
}

function normalizeEvent(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const token = normalizeToken(row.token);
  const timeframe = row.timeframe;
  const side = row.side;
  if (!token || !ALLOWED_TIMEFRAMES.includes(timeframe) || !['buy', 'sell'].includes(side)) {
    return null;
  }
  const rsi = Number(row.rsi);
  const threshold = Number(row.threshold);
  if (!Number.isFinite(rsi) || !Number.isFinite(threshold)) {
    return null;
  }
  return {
    id: String(row.id || crypto.randomUUID()),
    token,
    timeframe,
    side,
    rsi,
    threshold,
    walletAddress: row.walletAddress ?? row.wallet_address ?? null,
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
  };
}

function createFileStrategyEventsStore(filePath = process.env.STRATEGY_EVENTS_PATH || DEFAULT_FILE) {
  async function readStore() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      const events = Array.isArray(data.events) ? data.events.map(normalizeEvent).filter(Boolean) : [];
      const openState = data.openState && typeof data.openState === 'object' ? data.openState : {};
      return { events, openState };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { events: [], openState: {} };
      }
      throw err;
    }
  }

  async function writeStore({ events, openState }) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = JSON.stringify({ events, openState }, null, 2);
    await fs.writeFile(filePath, `${payload}\n`, 'utf8');
  }

  return {
    backend: 'file',
    filePath,

    async list({ token, timeframe, limit = 50 } = {}) {
      const { events } = await readStore();
      let filtered = events;
      if (token) {
        const normalized = normalizeToken(token);
        filtered = filtered.filter((e) => e.token === normalized);
      }
      if (timeframe) {
        filtered = filtered.filter((e) => e.timeframe === timeframe);
      }
      filtered = filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return filtered.slice(0, Math.max(1, Math.min(limit, 200)));
    },

    async recordSessionEvaluation({
      token,
      timeframe,
      rsi,
      buyBelow,
      sellAbove,
      walletAddress,
    }) {
      const store = await readStore();
      const newEvents = evaluateStrategyTransitions(store.openState, {
        token,
        timeframe,
        rsi,
        buyBelow,
        sellAbove,
        walletAddress,
      });
      if (newEvents.length === 0) {
        return [];
      }
      const persisted = newEvents.map((event) => ({
        id: crypto.randomUUID(),
        ...event,
        createdAt: new Date().toISOString(),
      }));
      store.events.push(...persisted);
      await writeStore(store);
      return persisted;
    },
  };
}

function createPgStrategyEventsStore(connectionString) {
  const sql = createSqlClient(connectionString);

  async function ready() {
    await ensureSchema(sql);
  }

  async function loadOpenState(token, timeframe) {
    await ready();
    const normalized = normalizeToken(token);
    const rows = await sql`
      SELECT side, active
      FROM strategy_signal_state
      WHERE token = ${normalized} AND timeframe = ${timeframe}
    `;
    const openState = {};
    for (const row of rows) {
      openState[stateKey(normalized, timeframe, row.side)] = Boolean(row.active);
    }
    return openState;
  }

  async function saveOpenState(token, timeframe, openState) {
    await ready();
    const normalized = normalizeToken(token);
    for (const side of ['buy', 'sell']) {
      const key = stateKey(normalized, timeframe, side);
      const active = Boolean(openState[key]);
      await sql`
        INSERT INTO strategy_signal_state (token, timeframe, side, active, updated_at)
        VALUES (${normalized}, ${timeframe}, ${side}, ${active}, NOW())
        ON CONFLICT (token, timeframe, side)
        DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
      `;
    }
  }

  return {
    backend: 'postgres',

    async list({ token, timeframe, limit = 50 } = {}) {
      await ready();
      const normalized = token ? normalizeToken(token) : null;
      const capped = Math.max(1, Math.min(limit, 200));
      let rows;
      if (normalized && timeframe) {
        rows = await sql`
          SELECT id, token, timeframe, side, rsi, threshold, wallet_address, created_at
          FROM strategy_events
          WHERE token = ${normalized} AND timeframe = ${timeframe}
          ORDER BY created_at DESC
          LIMIT ${capped}
        `;
      } else if (normalized) {
        rows = await sql`
          SELECT id, token, timeframe, side, rsi, threshold, wallet_address, created_at
          FROM strategy_events
          WHERE token = ${normalized}
          ORDER BY created_at DESC
          LIMIT ${capped}
        `;
      } else if (timeframe) {
        rows = await sql`
          SELECT id, token, timeframe, side, rsi, threshold, wallet_address, created_at
          FROM strategy_events
          WHERE timeframe = ${timeframe}
          ORDER BY created_at DESC
          LIMIT ${capped}
        `;
      } else {
        rows = await sql`
          SELECT id, token, timeframe, side, rsi, threshold, wallet_address, created_at
          FROM strategy_events
          ORDER BY created_at DESC
          LIMIT ${capped}
        `;
      }
      return rows.map((row) => normalizeEvent({
        id: row.id,
        token: row.token,
        timeframe: row.timeframe,
        side: row.side,
        rsi: row.rsi,
        threshold: row.threshold,
        wallet_address: row.wallet_address,
        created_at: row.created_at,
      })).filter(Boolean);
    },

    async recordSessionEvaluation({
      token,
      timeframe,
      rsi,
      buyBelow,
      sellAbove,
      walletAddress,
    }) {
      const openState = await loadOpenState(token, timeframe);
      const newEvents = evaluateStrategyTransitions(openState, {
        token,
        timeframe,
        rsi,
        buyBelow,
        sellAbove,
        walletAddress,
      });
      if (newEvents.length === 0) {
        await saveOpenState(token, timeframe, openState);
        return [];
      }
      await ready();
      const persisted = [];
      for (const event of newEvents) {
        const id = crypto.randomUUID();
        await sql`
          INSERT INTO strategy_events (id, token, timeframe, side, rsi, threshold, wallet_address)
          VALUES (
            ${id},
            ${event.token},
            ${event.timeframe},
            ${event.side},
            ${event.rsi},
            ${event.threshold},
            ${event.walletAddress}
          )
        `;
        persisted.push(normalizeEvent({
          id,
          ...event,
          created_at: new Date().toISOString(),
        }));
      }
      await saveOpenState(token, timeframe, openState);
      return persisted.filter(Boolean);
    },
  };
}

function createStrategyEventsStore(filePath) {
  const options = { filePath };
  if (shouldUseFilePersistence(options)) {
    const resolved = filePath || process.env.STRATEGY_EVENTS_PATH || DEFAULT_FILE;
    return createFileStrategyEventsStore(resolved);
  }
  return createPgStrategyEventsStore(requireDatabaseUrl());
}

module.exports = {
  createStrategyEventsStore,
  createFileStrategyEventsStore,
  createPgStrategyEventsStore,
  DEFAULT_FILE,
};
