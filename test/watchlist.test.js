const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createWatchlistStore } = require('../lib/watchlist');
const { createApp } = require('../index');
const { buildDecisionSession } = require('../lib/session');

async function tempWatchlistPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'watchlist-test-'));
  return path.join(dir, 'watchlist.json');
}

function mockTaapiResponse(value = 42.5, timestamp = 1700000000) {
  return async (url, config) => ({
    status: 200,
    data: { value, timestamp },
    config,
  });
}

describe('watchlist store', () => {
  it('lists empty when file is missing', async () => {
    const filePath = await tempWatchlistPath();
    const store = createWatchlistStore(filePath);
    assert.deepEqual(await store.list(), []);
  });

  it('adds, lists, and removes tokens with uppercase normalization', async () => {
    const filePath = await tempWatchlistPath();
    const store = createWatchlistStore(filePath);

    const addResult = await store.add(' eth ');
    assert.equal(addResult.ok, true);
    assert.equal(addResult.token, 'ETH');
    assert.deepEqual(await store.list(), ['ETH']);
    assert.equal(await store.has('eth'), true);

    const dup = await store.add('ETH');
    assert.equal(dup.ok, true);
    assert.deepEqual(await store.list(), ['ETH']);

    const removeResult = await store.remove('eth');
    assert.equal(removeResult.removed, true);
    assert.deepEqual(removeResult.tokens, []);
    assert.equal(await store.has('ETH'), false);
  });

  it('rejects empty token on add', async () => {
    const filePath = await tempWatchlistPath();
    const store = createWatchlistStore(filePath);
    const result = await store.add('   ');
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });
});

describe('watchlist HTTP API', () => {
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

  async function startServer(watchlistPath) {
    const app = createApp({ watchlistPath });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  }

  it('GET /api/watchlist returns tokens after POST and DELETE', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer(watchlistPath);

    let response = await fetch(`${baseUrl}/api/watchlist`);
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.deepEqual(body.tokens, []);

    response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'sol' }),
    });
    assert.equal(response.status, 201);
    body = await response.json();
    assert.equal(body.token, 'SOL');
    assert.deepEqual(body.tokens, ['SOL']);

    response = await fetch(`${baseUrl}/api/watchlist`);
    body = await response.json();
    assert.deepEqual(body.tokens, ['SOL']);

    response = await fetch(`${baseUrl}/api/watchlist/SOL`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.removed, true);
    assert.deepEqual(body.tokens, []);
  });

  it('POST /api/watchlist rejects empty token', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer(watchlistPath);

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /token/i);
  });
});

describe('session onWatchlist', () => {
  it('buildDecisionSession reflects onWatchlist flag', async () => {
    const { session: off } = await buildDecisionSession({
      token: 'BTC',
      timeframe: '1h',
      secret: 'test-secret',
      httpGet: mockTaapiResponse(),
      onWatchlist: false,
    });
    assert.equal(off.onWatchlist, false);

    const { session: on } = await buildDecisionSession({
      token: 'BTC',
      timeframe: '1h',
      secret: 'test-secret',
      httpGet: mockTaapiResponse(),
      onWatchlist: true,
    });
    assert.equal(on.onWatchlist, true);
  });

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

  it('GET /api/session sets onWatchlist from watchlist file', async () => {
    const watchlistPath = await tempWatchlistPath();
    const store = createWatchlistStore(watchlistPath);
    await store.add('ADA');

    const app = createApp({ watchlistPath });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    const original = process.env.TAAPI_SECRET;
    delete process.env.TAAPI_SECRET;

    let response = await fetch(`${baseUrl}/api/session?token=ADA&timeframe=15m`);
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.equal(body.onWatchlist, true);

    response = await fetch(`${baseUrl}/api/session?token=BTC&timeframe=15m`);
    body = await response.json();
    assert.equal(body.onWatchlist, false);

    if (original !== undefined) {
      process.env.TAAPI_SECRET = original;
    }
  });
});
