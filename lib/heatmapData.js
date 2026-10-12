const { DEFAULT_EXCHANGE, DEFAULT_QUOTE } = require('./constants');

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 30;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

/**
 * @param {{
 *   cacheTtlMs?: number,
 *   rateLimitWindowMs?: number,
 *   rateLimitMax?: number,
 *   now?: () => number,
 * }} [options]
 */
function createHeatmapDataGuard(options = {}) {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const rateLimitWindowMs = options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const rateLimitMax = options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
  const now = options.now || (() => Date.now());

  /** @type {Map<string, { expiresAt: number, body: Array<{ token: string, rsi: number }> }>} */
  const cache = new Map();
  /** @type {Map<string, { windowStart: number, count: number }>} */
  const rateBuckets = new Map();

  function getCached(interval) {
    const entry = cache.get(interval);
    if (!entry) {
      return null;
    }
    if (now() >= entry.expiresAt) {
      cache.delete(interval);
      return null;
    }
    return entry.body;
  }

  function setCached(interval, body) {
    cache.set(interval, { expiresAt: now() + cacheTtlMs, body });
  }

  function isRateLimited(ip) {
    const t = now();
    let bucket = rateBuckets.get(ip);
    if (!bucket || t - bucket.windowStart >= rateLimitWindowMs) {
      bucket = { windowStart: t, count: 0 };
      rateBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    return bucket.count > rateLimitMax;
  }

  function reset() {
    cache.clear();
    rateBuckets.clear();
  }

  return {
    getClientIp,
    getCached,
    setCached,
    isRateLimited,
    reset,
  };
}

/**
 * @param {{
 *   tokens: string[],
 *   interval: string,
 *   secret: string,
 *   rsiFetcher: (args: object) => Promise<{ value: number } | null>,
 * }} params
 */
async function buildHeatmapPayload({ tokens, interval, secret, rsiFetcher }) {
  const results = [];
  for (const token of tokens) {
    try {
      const point = await rsiFetcher({
        exchange: DEFAULT_EXCHANGE,
        symbol: `${token}/${DEFAULT_QUOTE}`,
        interval,
        secret,
      });
      if (point && Number.isFinite(point.value)) {
        results.push({ token, rsi: point.value });
      }
    } catch {
      // Skip tokens TAAPI cannot serve (rate limits, unknown pairs).
    }
  }
  return results;
}

const defaultGuard = createHeatmapDataGuard();

module.exports = {
  createHeatmapDataGuard,
  buildHeatmapPayload,
  getClientIp,
  defaultGuard,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
};
