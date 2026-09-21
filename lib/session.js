const { fetchRSISeries } = require('./taapiClient');
const { ALLOWED_TIMEFRAMES, DEFAULT_EXCHANGE, DEFAULT_QUOTE, DEFAULT_RSI_CHART_RESULTS } = require('./constants');

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
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  try {
    return date.toISOString();
  } catch {
    return null;
  }
}

function buildBaseSession({ token, timeframe, exchange = DEFAULT_EXCHANGE, onWatchlist = false }) {
  const pair = `${token}/${DEFAULT_QUOTE}`;
  return {
    token,
    pair,
    exchange,
    timeframe,
    rsi: null,
    rsiAsOf: null,
    rsiSeries: [],
    thresholds: { buyBelow: null, sellAbove: null, buyConditionId: null, sellConditionId: null },
    onWatchlist: Boolean(onWatchlist),
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
 * @param {boolean} [params.onWatchlist] - whether token is on the user watchlist
 * @param {object} [params.alertsStore] - alert condition store with evaluateForSession
 */
async function buildDecisionSession({
  token,
  timeframe,
  exchange,
  secret,
  httpGet,
  onWatchlist,
  alertsStore,
}) {
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
    onWatchlist,
  });

  const apiSecret = secret !== undefined ? secret : process.env.TAAPI_SECRET;
  if (!apiSecret) {
    session.errors = ['TAAPI_SECRET environment variable is not configured'];
    return { session };
  }

  try {
    const series = await fetchRSISeries(
      {
        exchange: resolvedExchange,
        symbol: session.pair,
        interval: timeframe,
        secret: apiSecret,
        results: DEFAULT_RSI_CHART_RESULTS,
      },
      httpGet,
    );
    session.rsiSeries = series.map((point) => ({
      value: point.value,
      time: toIsoTimestamp(point.timestamp),
    }));
    const latest = series[series.length - 1];
    session.rsi = latest.value;
    session.rsiAsOf = toIsoTimestamp(latest.timestamp);
  } catch (err) {
    session.errors = [`Failed to fetch RSI from TAAPI: ${err.message}`];
  }

  if (alertsStore && typeof alertsStore.getThresholdsForSession === 'function') {
    session.thresholds = await alertsStore.getThresholdsForSession({
      token: session.token,
      timeframe: session.timeframe,
    });
  }

  if (alertsStore && typeof alertsStore.evaluateForSession === 'function') {
    session.alert = await alertsStore.evaluateForSession({
      token: session.token,
      timeframe: session.timeframe,
      rsi: session.rsi,
    });
  }

  return { session };
}

module.exports = {
  ALLOWED_TIMEFRAMES,
  buildDecisionSession,
  validateTimeframe,
  validateToken,
};
