const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRsiSeriesPayload,
  fetchRSISeries,
  compactSymbol,
  clampResults,
  TAAPI_V2_RSI_URL,
  TAAPI_RSI_URL,
} = require('../lib/taapiClient');

describe('normalizeRsiSeriesPayload', () => {
  it('wraps a single numeric value', () => {
    const points = normalizeRsiSeriesPayload({ value: 44.2, timestamp: 1700000000 });
    assert.equal(points.length, 1);
    assert.equal(points[0].value, 44.2);
    assert.equal(points[0].timestamp, 1700000000);
  });

  it('parses parallel value/timestamp arrays', () => {
    const points = normalizeRsiSeriesPayload({
      value: [40, 41, 42],
      timestamp: [1, 2, 3],
    });
    assert.deepEqual(points.map((p) => p.value), [40, 41, 42]);
    assert.deepEqual(points.map((p) => p.timestamp), [1, 2, 3]);
  });

  it('rejects pending payloads', () => {
    assert.throws(
      () => normalizeRsiSeriesPayload({ pending: true }),
      /pending/,
    );
  });
});

describe('compactSymbol', () => {
  it('removes slash separators for v2', () => {
    assert.equal(compactSymbol('btc/usdt'), 'BTCUSDT');
  });
});

describe('clampResults', () => {
  it('caps basic plan at 50 candles', () => {
    const original = process.env.TAAPI_PLAN;
    process.env.TAAPI_PLAN = 'basic';
    assert.equal(clampResults(60), 50);
    if (original === undefined) {
      delete process.env.TAAPI_PLAN;
    } else {
      process.env.TAAPI_PLAN = original;
    }
  });
});

describe('fetchRSISeries', () => {
  it('requests TAAPI v2 with bearer auth and compact symbol', async () => {
    let seenUrl;
    let seenConfig;
    const httpGet = async (url, config) => {
      seenUrl = url;
      seenConfig = config;
      return {
        status: 200,
        data: {
          value: [50, 51, 52],
          timestamp: [10, 11, 12],
        },
      };
    };

    const series = await fetchRSISeries(
      {
        exchange: 'binance',
        symbol: 'BTC/USDT',
        timeframe: '1h',
        secret: 'test-key',
        results: 3,
      },
      httpGet,
    );

    assert.equal(seenUrl, TAAPI_V2_RSI_URL);
    assert.equal(seenConfig.headers.Authorization, 'Bearer test-key');
    assert.equal(seenConfig.params.symbol, 'BTCUSDT');
    assert.equal(seenConfig.params.timeframe, '1h');
    assert.equal(seenConfig.params.results, 3);
    assert.equal(series.length, 3);
    assert.equal(series[2].value, 52);
  });

  it('falls back to v1 when v2 fails', async () => {
    const httpGet = async (url, config) => {
      if (url === TAAPI_V2_RSI_URL) {
        return { status: 401, data: { error: 'Invalid or missing API key.' } };
      }
      if (url === TAAPI_RSI_URL) {
        assert.equal(config.params.interval, '4h');
        assert.equal(config.params.results, 2);
        return {
          status: 200,
          data: { value: [30, 31], timestamp: [1, 2] },
        };
      }
      throw new Error(`unexpected url ${url}`);
    };

    const series = await fetchRSISeries(
      {
        exchange: 'binance',
        symbol: 'ETH/USDT',
        interval: '4h',
        secret: 'legacy',
        results: 2,
      },
      httpGet,
    );

    assert.deepEqual(series.map((p) => p.value), [30, 31]);
  });
});
