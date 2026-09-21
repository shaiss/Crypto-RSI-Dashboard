const { ALLOWED_TIMEFRAMES } = require('./constants');
const { normalizeToken } = require('./watchlist');

/**
 * @typedef {'buy'|'sell'} StrategySide
 */

/**
 * Compute whether buy/sell paper signals are active for the current RSI and thresholds.
 *
 * @param {{ rsi: number|null, buyBelow: number|null, sellAbove: number|null }} params
 * @returns {{ buy: boolean, sell: boolean }}
 */
function computeStrategySignals({ rsi, buyBelow, sellAbove }) {
  if (rsi == null || !Number.isFinite(Number(rsi))) {
    return { buy: false, sell: false };
  }
  const rsiValue = Number(rsi);
  const buy = buyBelow != null && Number.isFinite(Number(buyBelow)) && rsiValue < Number(buyBelow);
  const sell = sellAbove != null && Number.isFinite(Number(sellAbove)) && rsiValue > Number(sellAbove);
  return { buy, sell };
}

/**
 * Apply idempotent open/close transitions and return new events to persist.
 *
 * @param {Record<string, boolean>} openState - mutable map key `${token}|${timeframe}|${side}`
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.timeframe
 * @param {number|null} params.rsi
 * @param {number|null} params.buyBelow
 * @param {number|null} params.sellAbove
 * @param {string|null} [params.walletAddress]
 * @returns {Array<{ token: string, timeframe: string, side: StrategySide, rsi: number, threshold: number, walletAddress: string|null }>}
 */
function evaluateStrategyTransitions(openState, {
  token,
  timeframe,
  rsi,
  buyBelow,
  sellAbove,
  walletAddress = null,
}) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken || !ALLOWED_TIMEFRAMES.includes(timeframe)) {
    return [];
  }
  const signals = computeStrategySignals({ rsi, buyBelow, sellAbove });
  if (rsi == null || !Number.isFinite(Number(rsi))) {
    return [];
  }
  const rsiValue = Number(rsi);
  const events = [];

  const sides = [
    { side: 'buy', active: signals.buy, threshold: buyBelow },
    { side: 'sell', active: signals.sell, threshold: sellAbove },
  ];

  for (const { side, active, threshold } of sides) {
    if (threshold == null || !Number.isFinite(Number(threshold))) {
      continue;
    }
    const key = `${normalizedToken}|${timeframe}|${side}`;
    const wasOpen = Boolean(openState[key]);
    if (active && !wasOpen) {
      openState[key] = true;
      events.push({
        token: normalizedToken,
        timeframe,
        side,
        rsi: rsiValue,
        threshold: Number(threshold),
        walletAddress,
      });
    } else if (!active && wasOpen) {
      openState[key] = false;
    }
  }

  return events;
}

module.exports = {
  computeStrategySignals,
  evaluateStrategyTransitions,
};
