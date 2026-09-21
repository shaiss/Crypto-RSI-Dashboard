const fs = require('fs/promises');
const path = require('path');
const { createSqlClient, ensureSchema } = require('./db');
const { shouldUseFilePersistence, requireDatabaseUrl } = require('./persistence');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'watchlist.json');

function normalizeToken(token) {
  if (token == null || !String(token).trim()) {
    return null;
  }
  return String(token).trim().toUpperCase();
}

function parseTokenList(raw) {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.tokens)) {
    return data.tokens;
  }
  return [];
}

function createFileWatchlistStore(filePath = process.env.WATCHLIST_PATH || DEFAULT_FILE) {
  async function readTokens() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const list = parseTokenList(raw);
      return [...new Set(list.map((t) => String(t).trim().toUpperCase()).filter(Boolean))].sort();
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async function writeTokens(tokens) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = JSON.stringify({ tokens }, null, 2);
    await fs.writeFile(filePath, `${payload}\n`, 'utf8');
  }

  return {
    filePath,
    backend: 'file',

    async list() {
      return readTokens();
    },

    async has(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return false;
      }
      const tokens = await readTokens();
      return tokens.includes(normalized);
    },

    async add(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return { ok: false, status: 400, error: 'token is required' };
      }
      const tokens = await readTokens();
      if (!tokens.includes(normalized)) {
        tokens.push(normalized);
        tokens.sort();
        await writeTokens(tokens);
      }
      return { ok: true, token: normalized, tokens };
    },

    async remove(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return { ok: false, status: 400, error: 'token is required' };
      }
      const tokens = await readTokens();
      const next = tokens.filter((t) => t !== normalized);
      const removed = next.length !== tokens.length;
      if (removed) {
        await writeTokens(next);
      }
      return { ok: true, removed, tokens: next };
    },
  };
}

function createPgWatchlistStore(connectionString) {
  const sql = createSqlClient(connectionString);

  async function ready() {
    await ensureSchema(sql);
  }

  return {
    backend: 'postgres',

    async list() {
      await ready();
      const rows = await sql`SELECT token FROM watchlist_tokens ORDER BY token ASC`;
      return rows.map((r) => r.token);
    },

    async has(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return false;
      }
      await ready();
      const rows = await sql`SELECT 1 AS ok FROM watchlist_tokens WHERE token = ${normalized} LIMIT 1`;
      return rows.length > 0;
    },

    async add(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return { ok: false, status: 400, error: 'token is required' };
      }
      await ready();
      await sql`
        INSERT INTO watchlist_tokens (token)
        VALUES (${normalized})
        ON CONFLICT (token) DO NOTHING
      `;
      const tokens = await this.list();
      return { ok: true, token: normalized, tokens };
    },

    async remove(token) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return { ok: false, status: 400, error: 'token is required' };
      }
      await ready();
      const deleted = await sql`
        DELETE FROM watchlist_tokens WHERE token = ${normalized} RETURNING token
      `;
      const tokens = await this.list();
      return { ok: true, removed: deleted.length > 0, tokens };
    },
  };
}

/**
 * @param {string} [filePath] - JSON file path when using file backend (tests / local)
 */
function createWatchlistStore(filePath) {
  const options = { filePath };
  if (shouldUseFilePersistence(options)) {
    const resolved = filePath || process.env.WATCHLIST_PATH || DEFAULT_FILE;
    return createFileWatchlistStore(resolved);
  }
  return createPgWatchlistStore(requireDatabaseUrl());
}

module.exports = {
  createWatchlistStore,
  createFileWatchlistStore,
  createPgWatchlistStore,
  normalizeToken,
  DEFAULT_FILE,
};
