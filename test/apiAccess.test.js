const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createApp } = require('../index');
const { createApiAccessMiddleware } = require('../lib/apiAccess');

async function tempWatchlistPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-access-watchlist-'));
  return path.join(dir, 'watchlist.json');
}

async function tempAlertsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-access-alerts-'));
  return path.join(dir, 'alerts.json');
}

describe('API access control', () => {
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

  async function startServer(appOptions = {}) {
    const app = createApp(appOptions);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  }

  it('GET /api/session stays open without APP_ACCESS_TOKEN in file mode', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createApiAccessMiddleware({
        getAppAccessToken: () => null,
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/session?token=BTC&timeframe=1h`);
    assert.equal(response.status, 200);
  });

  it('POST /api/watchlist returns 401 without token when APP_ACCESS_TOKEN is set', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createApiAccessMiddleware({
        getAppAccessToken: () => 'unit-test-secret',
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 401);
  });

  it('POST /api/watchlist succeeds with Bearer token when APP_ACCESS_TOKEN is set', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createApiAccessMiddleware({
        getAppAccessToken: () => 'unit-test-secret',
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer unit-test-secret',
      },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.token, 'BTC');
  });

  it('DELETE /api/alerts/:id returns 401 with wrong x-app-access-token', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer({
      alertsPath,
      apiAccessMiddleware: createApiAccessMiddleware({
        getAppAccessToken: () => 'alert-secret',
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/alerts/00000000-0000-4000-8000-000000000001`, {
      method: 'DELETE',
      headers: { 'x-app-access-token': 'wrong' },
    });
    assert.equal(response.status, 401);
  });

  it('POST /api/watchlist returns 503 in database mode without APP_ACCESS_TOKEN', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createApiAccessMiddleware({
        getAppAccessToken: () => null,
        isDatabaseMode: () => true,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 503);
  });
});
