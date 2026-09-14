const { fetchRSI } = require('./taapiClient');
const { ALLOWED_TIMEFRAMES, DEFAULT_EXCHANGE, DEFAULT_QUOTE } = require('./constants');

function validateTimeframe(timeframe) {
  if (!timeframe) {
    return { valid: false, error: 'timeframe query parameter is required' };
  }
  if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
    return {
      valid: false,
      error: `Invalid timeframe "${timeframe}". Allowed values: ${ALLOWED_TIMEFRAMES.join(' | ')}`,
    };
  }
  return { valid: true };
}

function validateToken(token) {
  if (!token || !String(token).trim()) {
    return { valid: false, error: 'token query parameter is required' };
  }
  return { valid: true, token: String(token).trim().toUpperCase() };
}

function toIsoTimestamp(timestamp) {
  if (timestamp == null) {
    return null;
  }
  const ms = typeof timestamp === 'number' && timestamp < 1e12
    ? timestamp * 1000
    : Number(timestamp);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function buildBaseSession({ token, timeframe, exchange = DEFAULT_EXCHANGE }) {
  const pair = `${token}/${DEFAULT_QUOTE}`;
  return {
    token,
    pair,
    exchange,
    timeframe,
    rsi: null,
    rsiAsOf: null,
    onWatchlist: false,
    alert: { status: 'none' },
  };
}

/**
 * Build a DecisionSession for the given token and timeframe.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.timeframe
 * @param {string} [params.exchange]
 * @param {string} [params.secret] - defaults to process.env.TAAPI_SECRET
 * @param {Function} [params.httpGet] - injectable HTTP client for tests
 */
async function buildDecisionSession({ token, timeframe, exchange, secret, httpGet }) {
  const tokenResult = validateToken(token);
  if (!tokenResult.valid) {
    return { error: tokenResult.error, status: 400 };
  }

  const timeframeResult = validateTimeframe(timeframe);
  if (!timeframeResult.valid) {
    return { error: timeframeResult.error, status: 400 };
  }

  const resolvedExchange = exchange || DEFAULT_EXCHANGE;
  const session = buildBaseSession({
    token: tokenResult.token,
    timeframe,
    exchange: resolvedExchange,
  });

  const apiSecret = secret !== undefined ? secret : process.env.TAAPI_SECRET;
  if (!apiSecret) {
    session.errors = ['TAAPI_SECRET environment variable is not configured'];
    return { session };
  }

  try {
    const rsiData = await fetchRSI(
      {
        exchange: resolvedExchange,
        symbol: session.pair,
        interval: timeframe,
        secret: apiSecret,
      },
      httpGet,
    );
    session.rsi = rsiData.value;
    session.rsiAsOf = toIsoTimestamp(rsiData.timestamp);
  } catch (err) {
    session.errors = [`Failed to fetch RSI from TAAPI: ${err.message}`];
  }

  return { session };
}

module.exports = {
  ALLOWED_TIMEFRAMES,
  buildDecisionSession,
  validateTimeframe,
  validateToken,
};
