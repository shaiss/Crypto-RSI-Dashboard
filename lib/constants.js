const ALLOWED_TIMEFRAMES = ['15m', '1h', '4h', '1d'];
const DEFAULT_EXCHANGE = 'binance';
const DEFAULT_QUOTE = 'USDT';

/** Suggested L1 / large-cap symbols for the decision UI (custom symbols still allowed). */
const SUGGESTED_L1_TOKENS = ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'ADA', 'DOT', 'LINK', 'XRP', 'MATIC'];

/**
 * RSI candles for the session chart (one TAAPI v2 call with `results`).
 * Clamped to plan limits in `lib/taapiClient.js` (Basic 50, Pro 300, Expert 2000).
 */
const DEFAULT_RSI_CHART_RESULTS = 60;

module.exports = {
  ALLOWED_TIMEFRAMES,
  DEFAULT_EXCHANGE,
  DEFAULT_QUOTE,
  SUGGESTED_L1_TOKENS,
  DEFAULT_RSI_CHART_RESULTS,
};
