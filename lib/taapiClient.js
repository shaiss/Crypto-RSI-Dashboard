const axios = require('axios');

const TAAPI_RSI_URL = 'https://api.taapi.io/rsi';

function normalizeRsiSeriesPayload(data) {
  if (data == null || typeof data !== 'object') {
    throw new Error('TAAPI response missing RSI payload');
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

/**
 * Fetch a window of RSI values from TAAPI (oldest → newest).
 *
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol - e.g. "BTC/USDT"
 * @param {string} params.interval - e.g. "1h"
 * @param {string} params.secret - TAAPI API secret
 * @param {number} [params.results=1]
 * @param {Function} [httpGet] - injectable HTTP client for tests
 * @returns {Promise<Array<{ value: number, timestamp?: number }>>}
 */
async function fetchRSISeries(
  { exchange, symbol, interval, secret, results = 1 },
  httpGet = axios.get,
) {
  const response = await httpGet(TAAPI_RSI_URL, {
    params: {
      secret,
      exchange,
      symbol,
      interval,
      results,
      addResultTimestamp: true,
    },
    timeout: 15_000,
  });

  if (response.status !== 200 || response.data == null) {
    throw new Error(`TAAPI returned unexpected status ${response.status}`);
  }

  return normalizeRsiSeriesPayload(response.data);
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
  normalizeRsiSeriesPayload,
  TAAPI_RSI_URL,
};
