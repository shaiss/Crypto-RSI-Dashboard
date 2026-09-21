const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  createAlertsStore,
  compareRsi,
  RECENT_WINDOW_MS,
} = require('../lib/alerts');
const { createApp } = require('../index');
const { buildDecisionSession } = require('../lib/session');

async function tempAlertsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'alerts-test-'));
  return path.join(dir, 'alerts.json');
}

function mockTaapiResponse(value = 42.5, timestamp = 1700000000) {
  return async (url, config) => ({
    status: 200,
    data: { value, timestamp },
    config,
  });
}

describe('alert threshold helpers', () => {
  it('setThresholds upserts buy/sell rules for token and timeframe', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);

    let result = await store.setThresholds({
      token: 'BTC',
      timeframe: '1h',
      buyBelow: 32,
      sellAbove: 68,
    });
    assert.equal(result.ok, true);
    assert.equal(result.thresholds.buyBelow, 32);
    assert.equal(result.thresholds.sellAbove, 68);

    const listed = await store.list();
    assert.equal(listed.length, 2);
    assert.ok(listed.some((c) => c.op === '<' && c.threshold === 32));
    assert.ok(listed.some((c) => c.op === '>' && c.threshold === 68));

    result = await store.setThresholds({
      token: 'BTC',
      timeframe: '1h',
      buyBelow: 28,
      sellAbove: null,
    });
    assert.equal(result.thresholds.buyBelow, 28);
    assert.equal(result.thresholds.sellAbove, null);
    assert.equal((await store.list()).length, 1);
  });

  it('getThresholdsForSession reads stored levels', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    await store.setThresholds({
      token: 'ETH',
      timeframe: '4h',
      buyBelow: 25,
      sellAbove: 75,
    });
    const thresholds = await store.getThresholdsForSession({
      token: 'eth',
      timeframe: '4h',
    });
    assert.equal(thresholds.buyBelow, 25);
    assert.equal(thresholds.sellAbove, 75);
  });
});

describe('alert condition store', () => {
  it('lists empty when file is missing', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    assert.deepEqual(await store.list(), []);
  });

  it('creates, lists, and removes conditions with validation', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);

    const addResult = await store.add({
      token: ' btc ',
      timeframe: '1h',
      op: '>=',
      threshold: 70,
    });
    assert.equal(addResult.ok, true);
    assert.equal(addResult.condition.token, 'BTC');
    assert.equal(addResult.condition.timeframe, '1h');
    assert.equal(addResult.condition.op, '>=');
    assert.equal(addResult.condition.threshold, 70);
    assert.match(addResult.condition.id, /^[0-9a-f-]{36}$/i);

    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, addResult.condition.id);

    const badTf = await store.add({ token: 'ETH', timeframe: '5m', op: '>', threshold: 30 });
    assert.equal(badTf.ok, false);
    assert.equal(badTf.status, 400);

    const badOp = await store.add({ token: 'ETH', timeframe: '1h', op: '==', threshold: 30 });
    assert.equal(badOp.ok, false);

    const removeResult = await store.remove(addResult.condition.id);
    assert.equal(removeResult.removed, true);
    assert.deepEqual(await store.list(), []);
  });
});

describe('alert evaluator', () => {
  it('compareRsi respects operators', () => {
    assert.equal(compareRsi(50, '<', 51), true);
    assert.equal(compareRsi(50, '<=', 50), true);
    assert.equal(compareRsi(50, '>', 49), true);
    assert.equal(compareRsi(50, '>=', 50), true);
    assert.equal(compareRsi(50, '>=', 51), false);
  });

  it('returns none when no matching condition or RSI not met', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    await store.add({ token: 'BTC', timeframe: '1h', op: '>=', threshold: 80 });

    let alert = await store.evaluateForSession({ token: 'BTC', timeframe: '1h', rsi: 55 });
    assert.deepEqual(alert, { status: 'none' });

    alert = await store.evaluateForSession({ token: 'ETH', timeframe: '1h', rsi: 90 });
    assert.deepEqual(alert, { status: 'none' });

    alert = await store.evaluateForSession({ token: 'BTC', timeframe: '1h', rsi: null });
    assert.deepEqual(alert, { status: 'none' });
  });

  it('returns active when condition is met and persists lastFiredAt', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    const add = await store.add({ token: 'SOL', timeframe: '4h', op: '<', threshold: 30 });
    const alert = await store.evaluateForSession({
      token: 'SOL',
      timeframe: '4h',
      rsi: 25,
    });

    assert.equal(alert.status, 'active');
    assert.equal(alert.conditionId, add.condition.id);
    assert.match(alert.summary, /SOL 4h RSI 25\.00 < 30/);

    const listed = await store.list();
    const row = listed.find((c) => c.id === add.condition.id);
    assert.ok(row.lastFiredAt);
  });

  it('returns recent within window after condition stops being met', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    const add = await store.add({ token: 'ADA', timeframe: '15m', op: '>', threshold: 60 });

    await store.evaluateForSession({ token: 'ADA', timeframe: '15m', rsi: 65 });
    const alert = await store.evaluateForSession({ token: 'ADA', timeframe: '15m', rsi: 55 });
    assert.equal(alert.status, 'recent');
    assert.equal(alert.conditionId, add.condition.id);

    const listed = await store.list();
    const row = listed.find((c) => c.id === add.condition.id);
    row.lastFiredAt = new Date(Date.now() - RECENT_WINDOW_MS - 1000).toISOString();
    await fs.writeFile(
      filePath,
      `${JSON.stringify({ conditions: listed }, null, 2)}\n`,
      'utf8',
    );

    const stale = await store.evaluateForSession({ token: 'ADA', timeframe: '15m', rsi: 55 });
    assert.deepEqual(stale, { status: 'none' });
  });
});

describe('buildDecisionSession alert wiring', () => {
  it('sets session.alert from evaluator when store is provided', async () => {
    const filePath = await tempAlertsPath();
    const store = createAlertsStore(filePath);
    await store.add({ token: 'BTC', timeframe: '1h', op: '>=', threshold: 50 });

    const { session } = await buildDecisionSession({
      token: 'BTC',
      timeframe: '1h',
      secret: 'test-secret',
      httpGet: mockTaapiResponse(72, 1700000000),
      alertsStore: store,
    });

    assert.equal(session.alert.status, 'active');
    assert.ok(session.alert.conditionId);
    assert.match(session.alert.summary, /BTC 1h RSI 72\.00 >= 50/);
  });
});

describe('alerts HTTP API and session.alert', () => {
  let server;
  let baseUrl;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      server = undefined;
    }
  });

  async function startServer(alertsPath) {
    const app = createApp({ alertsPath });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  }

  it('CRUD via HTTP', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer(alertsPath);

    let response = await fetch(`${baseUrl}/api/alerts`);
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.deepEqual(body.conditions, []);

    response = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'btc',
        timeframe: '1d',
        op: '<=',
        threshold: 40,
      }),
    });
    assert.equal(response.status, 201);
    body = await response.json();
    assert.equal(body.condition.token, 'BTC');
    const conditionId = body.condition.id;

    response = await fetch(`${baseUrl}/api/alerts`);
    body = await response.json();
    assert.equal(body.conditions.length, 1);

    response = await fetch(`${baseUrl}/api/alerts/${conditionId}`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.removed, true);
    assert.deepEqual(body.conditions, []);
  });

  it('DELETE /api/alerts/:id rejects non-UUID id', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer(alertsPath);

    const response = await fetch(`${baseUrl}/api/alerts/not-a-uuid`, { method: 'DELETE' });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /UUID/i);
  });

  it('POST /api/alerts rejects invalid payload', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer(alertsPath);

    const response = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '', timeframe: '1h', op: '>=', threshold: 10 }),
    });
    assert.equal(response.status, 400);
  });

  it('POST /api/alerts accepts buyBelow/sellAbove thresholds', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer(alertsPath);

    const response = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'SOL',
        timeframe: '15m',
        buyBelow: 30,
        sellAbove: 72,
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.thresholds.buyBelow, 30);
    assert.equal(body.thresholds.sellAbove, 72);
    assert.equal(body.conditions.length, 2);
  });
});
