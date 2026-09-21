const axios = require('axios');

/** Legacy v1 single-indicator endpoint (query-string `secret`). */
const TAAPI_RSI_URL = 'https://api.taapi.io/rsi';

/** TAAPI v2 RSI endpoint — supports `results` history windows with Bearer auth. */
const TAAPI_V2_RSI_URL = 'https://v2.taapi.io/indicator/rsi';

const PENDING_MAX_ATTEMPTS = 4;
const PENDING_RETRY_MS = 1500;

/**
 * TAAPI plan caps for `results` (see TAAPI docs / help center).
 * Basic: 50, Pro: 300, Expert: 2000 per indicator call.
 */
const TAAPI_RESULTS_PLAN_LIMITS = {
  basic: 50,
  pro: 300,
  expert: 2000,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactSymbol(symbol) {
  return String(symbol).replace(/\//g, '').toUpperCase();
}

function normalizeRsiSeriesPayload(data) {
  if (data == null || typeof data !== 'object') {
    throw new Error('TAAPI response missing RSI payload');
  }

  if (data.pending === true) {
    const err = new Error('TAAPI response pending');
    err.code = 'TAAPI_PENDING';
    throw err;
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  let values = data.value;
  let timestamps = data.timestamp;

  if (typeof values === 'number') {
    values = [values];
    timestamps = timestamps != null ? [timestamps] : [undefined];
  }

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('TAAPI response missing numeric RSI value');
  }

  const points = values.map((rawValue, index) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error('TAAPI response missing numeric RSI value');
    }
    const timestamp = timestamps != null ? timestamps[index] : undefined;
    return { value, timestamp };
  });

  return points;
}

function clampResults(results) {
  const parsed = Number(results);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  const plan = String(process.env.TAAPI_PLAN || 'basic').toLowerCase();
  const cap = TAAPI_RESULTS_PLAN_LIMITS[plan] ?? TAAPI_RESULTS_PLAN_LIMITS.basic;
  return Math.min(Math.floor(parsed), cap);
}

async function fetchJsonWithPendingRetry(requestFn, httpGet) {
  let lastError;
  for (let attempt = 0; attempt < PENDING_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await requestFn(httpGet);
      if (response.status !== 200 || response.data == null) {
        throw new Error(`TAAPI returned unexpected status ${response.status}`);
      }
      if (response.data.pending === true) {
        if (attempt < PENDING_MAX_ATTEMPTS - 1) {
          await sleep(PENDING_RETRY_MS);
          continue;
        }
        const err = new Error('TAAPI response pending');
        err.code = 'TAAPI_PENDING';
        throw err;
      }
      return response.data;
    } catch (err) {
      lastError = err;
      if (err.code === 'TAAPI_PENDING' && attempt < PENDING_MAX_ATTEMPTS - 1) {
        await sleep(PENDING_RETRY_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('TAAPI request failed after retries');
}

/**
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol
 * @param {string} params.timeframe
 * @param {string} params.secret
 * @param {number} params.results
 */
async function fetchRSISeriesV2(
  { exchange, symbol, timeframe, secret, results },
  httpGet = axios.get,
) {
  const data = await fetchJsonWithPendingRetry(
    (client) => client(TAAPI_V2_RSI_URL, {
      params: {
        exchange,
        symbol: compactSymbol(symbol),
        timeframe,
        results,
        period: 14,
      },
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      timeout: 15_000,
    }),
    httpGet,
  );

  return normalizeRsiSeriesPayload(data);
}

/**
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol
 * @param {string} params.interval
 * @param {string} params.secret
 * @param {number} params.results
 */
async function fetchRSISeriesV1(
  { exchange, symbol, interval, secret, results },
  httpGet = axios.get,
) {
  const data = await fetchJsonWithPendingRetry(
    (client) => client(TAAPI_RSI_URL, {
      params: {
        secret,
        exchange,
        symbol,
        interval,
        results,
        addResultTimestamp: true,
      },
      timeout: 15_000,
    }),
    httpGet,
  );

  return normalizeRsiSeriesPayload(data);
}

/**
 * Fetch a window of RSI values from TAAPI (oldest → newest).
 *
 * Uses TAAPI v2 (`/indicator/rsi` + Bearer token) so `results` returns a real
 * history array. Falls back to legacy v1 (`api.taapi.io/rsi` + `secret` query)
 * when v2 is unavailable.
 *
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol - e.g. "BTC/USDT"
 * @param {string} params.interval - e.g. "1h" (alias: `timeframe`)
 * @param {string} params.secret - TAAPI API secret / bearer token
 * @param {number} [params.results=1]
 * @param {Function} [httpGet] - injectable HTTP client for tests
 * @returns {Promise<Array<{ value: number, timestamp?: number }>>}
 */
async function fetchRSISeries(
  { exchange, symbol, interval, timeframe, secret, results = 1 },
  httpGet = axios.get,
) {
  const candleInterval = timeframe || interval;
  if (!candleInterval) {
    throw new Error('interval or timeframe is required');
  }

  const window = clampResults(results);

  try {
    const series = await fetchRSISeriesV2(
      {
        exchange,
        symbol,
        timeframe: candleInterval,
        secret,
        results: window,
      },
      httpGet,
    );
    if (series.length > 1 || window <= 1) {
      return series;
    }
  } catch {
    // Fall back to v1 below.
  }

  return fetchRSISeriesV1(
    {
      exchange,
      symbol,
      interval: candleInterval,
      secret,
      results: window,
    },
    httpGet,
  );
}

/**
 * Fetch the latest RSI point from TAAPI for a given exchange, symbol, and interval.
 *
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol - e.g. "BTC/USDT"
 * @param {string} params.interval - e.g. "1h"
 * @param {string} params.secret - TAAPI API secret
 * @param {Function} [httpGet] - injectable HTTP client for tests
 * @returns {Promise<{ value: number, timestamp?: number }>}
 */
async function fetchRSI(params, httpGet = axios.get) {
  const series = await fetchRSISeries({ ...params, results: 1 }, httpGet);
  return series[series.length - 1];
}

module.exports = {
  fetchRSI,
  fetchRSISeries,
  fetchRSISeriesV2,
  fetchRSISeriesV1,
  normalizeRsiSeriesPayload,
  compactSymbol,
  clampResults,
  TAAPI_RSI_URL,
  TAAPI_V2_RSI_URL,
  TAAPI_RESULTS_PLAN_LIMITS,
};
