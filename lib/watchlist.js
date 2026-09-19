const fs = require('fs/promises');
const path = require('path');

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

/**
 * @param {string} [filePath] - JSON file path; override via options or WATCHLIST_PATH
 */
function createWatchlistStore(filePath = process.env.WATCHLIST_PATH || DEFAULT_FILE) {
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

module.exports = {
  createWatchlistStore,
  normalizeToken,
  DEFAULT_FILE,
};
