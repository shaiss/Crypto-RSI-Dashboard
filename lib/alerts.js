const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { ALLOWED_TIMEFRAMES } = require('./constants');
const { normalizeToken, parseTokenInput } = require('./watchlist');
const { createSqlClient, ensureSchema } = require('./db');
const { shouldUseFilePersistence, requireDatabaseUrl } = require('./persistence');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

/** @type {readonly string[]} */
const ALLOWED_OPS = ['<', '<=', '>', '>='];

/** How long after a fired alert we still report `recent` (no background poll). */
const RECENT_WINDOW_MS = 15 * 60 * 1000;

const BUY_OPS = ['<', '<='];
const SELL_OPS = ['>', '>='];

function isBuyOp(op) {
  return BUY_OPS.includes(op);
}

function isSellOp(op) {
  return SELL_OPS.includes(op);
}

function extractThresholdsFromConditions(conditions, token, timeframe) {
  const normalizedToken = normalizeToken(token);
  const matching = conditions.filter(
    (c) => c.token === normalizedToken && c.timeframe === timeframe,
  );
  let buyBelow = null;
  let sellAbove = null;
  let buyConditionId = null;
  let sellConditionId = null;
  for (const condition of matching) {
    if (isBuyOp(condition.op)) {
      buyBelow = condition.threshold;
      buyConditionId = condition.id;
    } else if (isSellOp(condition.op)) {
      sellAbove = condition.threshold;
      sellConditionId = condition.id;
    }
  }
  return { buyBelow, sellAbove, buyConditionId, sellConditionId };
}

function applyThresholdUpdates(conditions, { token, timeframe, buyBelow, sellAbove }) {
  const parsed = parseTokenInput(token);
  if (!parsed.ok) {
    return parsed;
  }
  const normalizedToken = parsed.token;
  const tfResult = validateTimeframe(timeframe);
  if (!tfResult.valid) {
    return { ok: false, status: 400, error: tfResult.error };
  }

  const next = conditions.filter(
    (c) => !(
      c.token === normalizedToken
      && c.timeframe === tfResult.timeframe
      && (isBuyOp(c.op) || isSellOp(c.op))
    ),
  );

  const hasBuy = buyBelow != null && buyBelow !== '';
  const hasSell = sellAbove != null && sellAbove !== '';

  if (hasBuy) {
    const thresholdResult = validateThreshold(buyBelow);
    if (!thresholdResult.valid) {
      return { ok: false, status: 400, error: thresholdResult.error };
    }
    next.push({
      id: crypto.randomUUID(),
      token: normalizedToken,
      timeframe: tfResult.timeframe,
      op: '<',
      threshold: thresholdResult.threshold,
    });
  }

  if (hasSell) {
    const thresholdResult = validateThreshold(sellAbove);
    if (!thresholdResult.valid) {
      return { ok: false, status: 400, error: thresholdResult.error };
    }
    next.push({
      id: crypto.randomUUID(),
      token: normalizedToken,
      timeframe: tfResult.timeframe,
      op: '>',
      threshold: thresholdResult.threshold,
    });
  }

  return {
    ok: true,
    conditions: next,
    thresholds: extractThresholdsFromConditions(next, normalizedToken, tfResult.timeframe),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidAlertId(id) {
  return UUID_RE.test(String(id).trim());
}

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
    ...(row.lastFiredAt || row.last_fired_at
      ? { lastFiredAt: String(row.lastFiredAt || row.last_fired_at) }
      : {}),
  };
}

function rowToCondition(row) {
  if (!row) {
    return null;
  }
  return normalizeCondition({
    id: row.id,
    token: row.token,
    timeframe: row.timeframe,
    op: row.op,
    threshold: row.threshold,
    lastFiredAt: row.last_fired_at,
  });
}

function createFileAlertsStore(filePath = process.env.ALERTS_PATH || DEFAULT_FILE) {
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
    backend: 'file',
    ALLOWED_OPS,

    async list() {
      return readConditions();
    },

    async add({ token, timeframe, op, threshold }) {
      const parsed = parseTokenInput(token);
      if (!parsed.ok) {
        return parsed;
      }
      const normalized = parsed.token;

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
      if (!isValidAlertId(targetId)) {
        return { ok: false, status: 400, error: 'id must be a valid UUID' };
      }
      const conditions = await readConditions();
      const next = conditions.filter((c) => c.id !== targetId);
      const removed = next.length !== conditions.length;
      if (removed) {
        await writeConditions(next);
      }
      return { ok: true, removed, conditions: next };
    },

    async getThresholdsForSession({ token, timeframe }) {
      const conditions = await readConditions();
      return extractThresholdsFromConditions(conditions, token, timeframe);
    },

    async setThresholds({ token, timeframe, buyBelow, sellAbove }) {
      const conditions = await readConditions();
      const result = applyThresholdUpdates(conditions, {
        token,
        timeframe,
        buyBelow,
        sellAbove,
      });
      if (!result.ok) {
        return result;
      }
      await writeConditions(result.conditions);
      return {
        ok: true,
        thresholds: result.thresholds,
        conditions: result.conditions,
      };
    },

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

function createPgAlertsStore(connectionString) {
  const sql = createSqlClient(connectionString);

  async function ready() {
    await ensureSchema(sql);
  }

  async function readConditions() {
    await ready();
    const rows = await sql`
      SELECT id, token, timeframe, op, threshold, last_fired_at
      FROM alert_conditions
      ORDER BY created_at ASC
    `;
    return rows.map(rowToCondition).filter(Boolean);
  }

  return {
    backend: 'postgres',
    ALLOWED_OPS,

    async list() {
      return readConditions();
    },

    async add({ token, timeframe, op, threshold }) {
      const parsed = parseTokenInput(token);
      if (!parsed.ok) {
        return parsed;
      }
      const normalized = parsed.token;

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

      await ready();
      await sql`
        INSERT INTO alert_conditions (id, token, timeframe, op, threshold)
        VALUES (
          ${condition.id},
          ${condition.token},
          ${condition.timeframe},
          ${condition.op},
          ${condition.threshold}
        )
      `;

      const conditions = await readConditions();
      return { ok: true, condition, conditions };
    },

    async remove(id) {
      if (!id || !String(id).trim()) {
        return { ok: false, status: 400, error: 'id is required' };
      }
      const targetId = String(id).trim();
      if (!isValidAlertId(targetId)) {
        return { ok: false, status: 400, error: 'id must be a valid UUID' };
      }
      await ready();
      const deleted = await sql`
        DELETE FROM alert_conditions WHERE id = ${targetId} RETURNING id
      `;
      const conditions = await readConditions();
      return { ok: true, removed: deleted.length > 0, conditions };
    },

    async getThresholdsForSession({ token, timeframe }) {
      const conditions = await readConditions();
      return extractThresholdsFromConditions(conditions, token, timeframe);
    },

    async setThresholds({ token, timeframe, buyBelow, sellAbove }) {
      const conditions = await readConditions();
      const result = applyThresholdUpdates(conditions, {
        token,
        timeframe,
        buyBelow,
        sellAbove,
      });
      if (!result.ok) {
        return result;
      }

      const normalizedToken = normalizeToken(token);
      const tfResult = validateTimeframe(timeframe);
      await ready();
      await sql`
        DELETE FROM alert_conditions
        WHERE token = ${normalizedToken}
          AND timeframe = ${tfResult.timeframe}
          AND op IN ('<', '<=', '>', '>=')
      `;

      const inserted = result.conditions.filter(
        (c) => c.token === normalizedToken && c.timeframe === tfResult.timeframe
          && (isBuyOp(c.op) || isSellOp(c.op)),
      );
      for (const condition of inserted) {
        await sql`
          INSERT INTO alert_conditions (id, token, timeframe, op, threshold)
          VALUES (
            ${condition.id},
            ${condition.token},
            ${condition.timeframe},
            ${condition.op},
            ${condition.threshold}
          )
        `;
      }

      const next = await readConditions();
      return {
        ok: true,
        thresholds: result.thresholds,
        conditions: next,
      };
    },

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
        await ready();
        await sql`
          UPDATE alert_conditions
          SET last_fired_at = ${nowIso}::timestamptz
          WHERE id = ${condition.id}
        `;
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

/**
 * @param {string} [filePath] - JSON file path when using file backend (tests / local)
 */
function createAlertsStore(filePath) {
  const options = { filePath };
  if (shouldUseFilePersistence(options)) {
    const resolved = filePath || process.env.ALERTS_PATH || DEFAULT_FILE;
    return createFileAlertsStore(resolved);
  }
  return createPgAlertsStore(requireDatabaseUrl());
}

module.exports = {
  createAlertsStore,
  createFileAlertsStore,
  createPgAlertsStore,
  ALLOWED_OPS,
  BUY_OPS,
  SELL_OPS,
  compareRsi,
  extractThresholdsFromConditions,
  applyThresholdUpdates,
  formatSummary,
  isValidAlertId,
  DEFAULT_FILE,
  RECENT_WINDOW_MS,
};
