const axios = require('axios');

const TAAPI_RSI_URL = 'https://api.taapi.io/rsi';

/**
 * Fetch RSI from TAAPI for a given exchange, symbol, and interval.
 *
 * @param {object} params
 * @param {string} params.exchange
 * @param {string} params.symbol - e.g. "BTC/USDT"
 * @param {string} params.interval - e.g. "1h"
 * @param {string} params.secret - TAAPI API secret
 * @param {Function} [httpGet] - injectable HTTP client for tests
 * @returns {Promise<{ value: number, timestamp?: number }>}
 */
async function fetchRSI({ exchange, symbol, interval, secret }, httpGet = axios.get) {
  const response = await httpGet(TAAPI_RSI_URL, {
    params: {
      secret,
      exchange,
      symbol,
      interval,
      addResultTimestamp: true,
    },
    timeout: 10_000,
  });

  if (response.status !== 200 || response.data == null) {
    throw new Error(`TAAPI returned unexpected status ${response.status}`);
  }

  const { value, timestamp } = response.data;
  if (typeof value !== 'number') {
    throw new Error('TAAPI response missing numeric RSI value');
  }

  return { value, timestamp };
}

module.exports = { fetchRSI, TAAPI_RSI_URL };
