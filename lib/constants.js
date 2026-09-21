const ALLOWED_TIMEFRAMES = ['15m', '1h', '4h', '1d'];
const DEFAULT_EXCHANGE = 'binance';
const DEFAULT_QUOTE = 'USDT';

/** Suggested L1 / large-cap symbols for the decision UI (custom symbols still allowed). */
const SUGGESTED_L1_TOKENS = ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'ADA', 'DOT', 'LINK', 'XRP', 'MATIC'];

/** Number of RSI candles returned for the session chart (single TAAPI call). */
const DEFAULT_RSI_CHART_RESULTS = 60;

module.exports = {
  ALLOWED_TIMEFRAMES,
  DEFAULT_EXCHANGE,
  DEFAULT_QUOTE,
  SUGGESTED_L1_TOKENS,
  DEFAULT_RSI_CHART_RESULTS,
};
