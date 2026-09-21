const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../index');
const { buildDecisionSession } = require('../lib/session');

function mockTaapiResponse(value = 42.5, timestamp = 1700000000) {
  return async (url, config) => {
    const results = config?.params?.results ?? 1;
    const count = Math.max(1, Number(results) || 1);
    const values = Array.from({ length: count }, (_, index) => {
      if (Array.isArray(value)) {
        return value[index] ?? value[value.length - 1];
      }
      return value;
    });
    const timestamps = Array.from({ length: count }, (_, index) => {
      const base = Array.isArray(timestamp) ? timestamp[0] : timestamp;
      return base + index;
    });
    const data = count === 1
      ? { value: values[0], timestamp: timestamps[0] }
      : { value: values, timestamp: timestamps };
    return {
      status: 200,
      data,
      config,
    };
  };
}

describe('buildDecisionSession', () => {
  it('returns a DecisionSession with mocked TAAPI data', async () => {
    const { session } = await buildDecisionSession({
      token: 'btc',
      timeframe: '1h',
      secret: 'test-secret',
      httpGet: mockTaapiResponse(55.1, 1700000000),
    });

    assert.equal(session.token, 'BTC');
    assert.equal(session.pair, 'BTC/USDT');
    assert.equal(session.exchange, 'binance');
    assert.equal(session.timeframe, '1h');
    assert.equal(session.rsi, 55.1);
    const { DEFAULT_RSI_CHART_RESULTS } = require('../lib/constants');
    const latestTs = 1700000000 + DEFAULT_RSI_CHART_RESULTS - 1;
    assert.equal(session.rsiAsOf, new Date(latestTs * 1000).toISOString());
    assert.equal(session.onWatchlist, false);
    assert.deepEqual(session.alert, { status: 'none' });
    assert.equal(session.rsiSeries.length, DEFAULT_RSI_CHART_RESULTS);
    assert.equal(session.rsiSeries[session.rsiSeries.length - 1].value, 55.1);
    assert.deepEqual(session.thresholds, {
      buyBelow: null,
      sellAbove: null,
      buyConditionId: null,
      sellConditionId: null,
    });
    assert.equal(session.errors, undefined);
  });

  it('fails closed when TAAPI_SECRET is missing', async () => {
    const original = process.env.TAAPI_SECRET;
    delete process.env.TAAPI_SECRET;

    const { session } = await buildDecisionSession({
      token: 'ETH',
      timeframe: '4h',
    });

    assert.equal(session.rsi, null);
    assert.equal(session.rsiAsOf, null);
    assert.deepEqual(session.errors, ['TAAPI_SECRET environment variable is not configured']);

    if (original !== undefined) {
      process.env.TAAPI_SECRET = original;
    }
  });

  it('rejects invalid timeframe', async () => {
    const result = await buildDecisionSession({
      token: 'BTC',
      timeframe: '5m',
      secret: 'test-secret',
    });

    assert.equal(result.status, 400);
    assert.match(result.error, /Invalid timeframe/);
  });

  it('rejects missing token', async () => {
    const result = await buildDecisionSession({
      timeframe: '1h',
      secret: 'test-secret',
    });

    assert.equal(result.status, 400);
    assert.match(result.error, /token/);
  });
});

describe('GET /api/session', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns 400 for invalid timeframe', async () => {
    const response = await fetch(`${baseUrl}/api/session?token=BTC&timeframe=2h`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Invalid timeframe/);
  });

  it('returns session with errors when secret is missing', async () => {
    const original = process.env.TAAPI_SECRET;
    delete process.env.TAAPI_SECRET;

    const response = await fetch(`${baseUrl}/api/session?token=BTC&timeframe=1d`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.rsi, null);
    assert.deepEqual(body.errors, ['TAAPI_SECRET environment variable is not configured']);

    if (original !== undefined) {
      process.env.TAAPI_SECRET = original;
    }
  });
});
