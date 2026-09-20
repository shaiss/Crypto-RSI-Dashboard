const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { ALLOWED_TIMEFRAMES } = require('./constants');
const { normalizeToken } = require('./watchlist');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

/** @type {readonly string[]} */
const ALLOWED_OPS = ['<', '<=', '>', '>='];

/** How long after a fired alert we still report `recent` (no background poll). */
const RECENT_WINDOW_MS = 15 * 60 * 1000;

function parseConditions(raw) {
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.conditions)) {
    return data.conditions;
  }
  return [];
}

function isAllowedOp(op) {
  return ALLOWED_OPS.includes(op);
}

function validateThreshold(threshold) {
  const value = Number(threshold);
  if (!Number.isFinite(value)) {
    return { valid: false, error: 'threshold must be a finite number' };
  }
  return { valid: true, threshold: value };
}

function validateTimeframe(timeframe) {
  if (!timeframe || !ALLOWED_TIMEFRAMES.includes(timeframe)) {
    return {
      valid: false,
      error: `Invalid timeframe. Allowed values: ${ALLOWED_TIMEFRAMES.join(' | ')}`,
    };
  }
  return { valid: true, timeframe };
}

function compareRsi(rsi, op, threshold) {
  switch (op) {
    case '<':
      return rsi < threshold;
    case '<=':
      return rsi <= threshold;
    case '>':
      return rsi > threshold;
    case '>=':
      return rsi >= threshold;
    default:
      return false;
  }
}

function formatSummary({ rsi, op, threshold, token, timeframe }) {
  const rsiText = Number.isFinite(rsi) ? rsi.toFixed(2) : String(rsi);
  return `${token} ${timeframe} RSI ${rsiText} ${op} ${threshold}`;
}

function normalizeCondition(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const token = normalizeToken(row.token);
  const timeframe = row.timeframe;
  const op = row.op;
  const threshold = Number(row.threshold);
  if (!token || !validateTimeframe(timeframe).valid || !isAllowedOp(op) || !Number.isFinite(threshold)) {
    return null;
  }
  return {
    id: String(row.id || crypto.randomUUID()),
    token,
    timeframe,
    op,
    threshold,
    ...(row.lastFiredAt ? { lastFiredAt: String(row.lastFiredAt) } : {}),
  };
}

/**
 * @param {string} [filePath] - JSON file path; override via options or ALERTS_PATH
 */
function createAlertsStore(filePath = process.env.ALERTS_PATH || DEFAULT_FILE) {
  async function readConditions() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return parseConditions(raw)
        .map(normalizeCondition)
        .filter(Boolean);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async function writeConditions(conditions) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload = JSON.stringify({ conditions }, null, 2);
    await fs.writeFile(filePath, `${payload}\n`, 'utf8');
  }

  return {
    filePath,
    ALLOWED_OPS,

    async list() {
      return readConditions();
    },

    async add({ token, timeframe, op, threshold }) {
      const normalized = normalizeToken(token);
      if (!normalized) {
        return { ok: false, status: 400, error: 'token is required' };
      }

      const tfResult = validateTimeframe(timeframe);
      if (!tfResult.valid) {
        return { ok: false, status: 400, error: tfResult.error };
      }

      if (!isAllowedOp(op)) {
        return {
          ok: false,
          status: 400,
          error: `Invalid op. Allowed values: ${ALLOWED_OPS.join(' | ')}`,
        };
      }

      const thresholdResult = validateThreshold(threshold);
      if (!thresholdResult.valid) {
        return { ok: false, status: 400, error: thresholdResult.error };
      }

      const condition = {
        id: crypto.randomUUID(),
        token: normalized,
        timeframe: tfResult.timeframe,
        op,
        threshold: thresholdResult.threshold,
      };

      const conditions = await readConditions();
      conditions.push(condition);
      await writeConditions(conditions);

      return { ok: true, condition, conditions };
    },

    async remove(id) {
      if (!id || !String(id).trim()) {
        return { ok: false, status: 400, error: 'id is required' };
      }
      const targetId = String(id).trim();
      const conditions = await readConditions();
      const next = conditions.filter((c) => c.id !== targetId);
      const removed = next.length !== conditions.length;
      if (removed) {
        await writeConditions(next);
      }
      return { ok: true, removed, conditions: next };
    },

    /**
     * Evaluate alert state for a session using the latest RSI (evaluate-on-fetch only).
     * Updates lastFiredAt when a condition is currently met.
     */
    async evaluateForSession({ token, timeframe, rsi }) {
      const normalizedToken = normalizeToken(token);
      if (!normalizedToken || !validateTimeframe(timeframe).valid) {
        return { status: 'none' };
      }
      if (rsi == null || !Number.isFinite(Number(rsi))) {
        return { status: 'none' };
      }
      const rsiValue = Number(rsi);

      const conditions = await readConditions();
      const matching = conditions.filter(
        (c) => c.token === normalizedToken && c.timeframe === timeframe,
      );

      if (matching.length === 0) {
        return { status: 'none' };
      }

      let firedIndex = -1;
      for (let i = 0; i < matching.length; i += 1) {
        const condition = matching[i];
        if (compareRsi(rsiValue, condition.op, condition.threshold)) {
          firedIndex = i;
          break;
        }
      }

      if (firedIndex >= 0) {
        const condition = matching[firedIndex];
        const nowIso = new Date().toISOString();
        const all = await readConditions();
        const idx = all.findIndex((c) => c.id === condition.id);
        if (idx >= 0) {
          all[idx] = { ...all[idx], lastFiredAt: nowIso };
          await writeConditions(all);
        }
        return {
          status: 'active',
          conditionId: condition.id,
          summary: formatSummary({
            rsi: rsiValue,
            op: condition.op,
            threshold: condition.threshold,
            token: normalizedToken,
            timeframe,
          }),
        };
      }

      const now = Date.now();
      for (const condition of matching) {
        if (!condition.lastFiredAt) {
          continue;
        }
        const firedAt = Date.parse(condition.lastFiredAt);
        if (!Number.isFinite(firedAt)) {
          continue;
        }
        if (now - firedAt <= RECENT_WINDOW_MS) {
          return {
            status: 'recent',
            conditionId: condition.id,
            summary: formatSummary({
              rsi: rsiValue,
              op: condition.op,
              threshold: condition.threshold,
              token: normalizedToken,
              timeframe,
            }),
          };
        }
      }

      return { status: 'none' };
    },
  };
}

module.exports = {
  createAlertsStore,
  ALLOWED_OPS,
  compareRsi,
  formatSummary,
  DEFAULT_FILE,
  RECENT_WINDOW_MS,
};
