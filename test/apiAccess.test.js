const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createApp } = require('../index');
const {
  createClerkAuthMiddleware,
  getAllowlistEmails,
  isAllowlistConfigured,
  isEmailAllowlisted,
} = require('../lib/apiAccess');

async function tempWatchlistPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-access-watchlist-'));
  return path.join(dir, 'watchlist.json');
}

async function tempAlertsPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-access-alerts-'));
  return path.join(dir, 'alerts.json');
}

describe('Clerk allowlist helpers', () => {
  it('returns empty list when CLERK_ALLOWLIST_EMAILS is unset', () => {
    const previous = process.env.CLERK_ALLOWLIST_EMAILS;
    delete process.env.CLERK_ALLOWLIST_EMAILS;
    assert.deepEqual(getAllowlistEmails(), []);
    assert.equal(isAllowlistConfigured(), false);
    if (previous !== undefined) {
      process.env.CLERK_ALLOWLIST_EMAILS = previous;
    }
  });

  it('parses comma-separated CLERK_ALLOWLIST_EMAILS', () => {
    const previous = process.env.CLERK_ALLOWLIST_EMAILS;
    process.env.CLERK_ALLOWLIST_EMAILS = ' One@Example.com , two@example.com ';
    assert.deepEqual(getAllowlistEmails(), ['one@example.com', 'two@example.com']);
    assert.equal(isAllowlistConfigured(), true);
    if (previous === undefined) {
      delete process.env.CLERK_ALLOWLIST_EMAILS;
    } else {
      process.env.CLERK_ALLOWLIST_EMAILS = previous;
    }
  });

  it('isEmailAllowlisted is case-insensitive', () => {
    assert.equal(isEmailAllowlisted('Admin@Example.com', () => ['admin@example.com']), true);
    assert.equal(isEmailAllowlisted('nope@example.com', () => ['admin@example.com']), false);
  });
});

describe('Clerk API access control', () => {
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

  function clerkMiddleware(overrides = {}) {
    const allowlist = overrides.allowlist || ['admin@example.com'];
    const email = overrides.email ?? 'admin@example.com';
    return createClerkAuthMiddleware({
      getClerkSecretKey: () => overrides.secretKey ?? 'sk_test_mock',
      getClerkPublishableKey: () => 'pk_test_mock',
      getAllowlistEmails: () => allowlist.map((e) => e.toLowerCase()),
      isDatabaseMode: () => overrides.databaseMode ?? false,
      resolveAuthenticatedEmail: overrides.resolveAuthenticatedEmail
        || (async () => email),
      resolveAuthenticatedContext: overrides.resolveAuthenticatedContext
        || (async () => {
          const resolvedEmail = overrides.resolveAuthenticatedEmail
            ? await overrides.resolveAuthenticatedEmail({})
            : email;
          if (!resolvedEmail) {
            return null;
          }
          return {
            userId: 'test-user',
            email: resolvedEmail,
            emailNormalized: String(resolvedEmail).trim().toLowerCase(),
            walletConnected: overrides.walletConnected ?? false,
            walletAddress: overrides.walletAddress ?? null,
            walletAddressTruncated: overrides.walletAddressTruncated ?? null,
          };
        }),
    });
  }

  it('GET /api/session stays open without Clerk in file mode', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createClerkAuthMiddleware({
        getClerkSecretKey: () => null,
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/session?token=BTC&timeframe=1h`);
    assert.equal(response.status, 200);
  });

  it('POST /api/watchlist returns 401 without Clerk session when auth is enforced', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({
        resolveAuthenticatedEmail: async () => null,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 401);
  });

  it('POST /api/watchlist succeeds for allowlisted Clerk user', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({ email: 'admin@example.com' }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-session-jwt',
      },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.token, 'BTC');
  });

  it('GET /api/watchlist returns 403 when signed-in email is not allowlisted', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({ email: 'other@example.com' }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`);
    assert.equal(response.status, 403);
  });

  it('GET /api/watchlist returns 401 without Clerk session when auth is enforced', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({
        resolveAuthenticatedEmail: async () => null,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`);
    assert.equal(response.status, 401);
  });

  it('GET /api/alerts returns 401 without Clerk session when auth is enforced', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer({
      alertsPath,
      apiAccessMiddleware: clerkMiddleware({
        resolveAuthenticatedEmail: async () => null,
      }),
    });

    const response = await fetch(`${baseUrl}/api/alerts`);
    assert.equal(response.status, 401);
  });

  it('DELETE /api/alerts/:id returns 401 without session when auth is enforced', async () => {
    const alertsPath = await tempAlertsPath();
    await startServer({
      alertsPath,
      apiAccessMiddleware: clerkMiddleware({
        resolveAuthenticatedEmail: async () => null,
      }),
    });

    const response = await fetch(`${baseUrl}/api/alerts/00000000-0000-4000-8000-000000000001`, {
      method: 'DELETE',
    });
    assert.equal(response.status, 401);
  });

  it('POST /api/watchlist returns 503 in database mode without CLERK_SECRET_KEY', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createClerkAuthMiddleware({
        getClerkSecretKey: () => null,
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

  it('POST /api/watchlist returns 503 when auth enforced but allowlist is empty', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: createClerkAuthMiddleware({
        getClerkSecretKey: () => 'sk_test_mock',
        getAllowlistEmails: () => [],
        isDatabaseMode: () => false,
      }),
    });

    const response = await fetch(`${baseUrl}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'BTC' }),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /CLERK_ALLOWLIST_EMAILS/);
  });

  it('GET /api/strategy/events returns 403 without connected wallet', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({ walletConnected: false }),
    });

    const response = await fetch(`${baseUrl}/api/strategy/events`, {
      headers: { Authorization: 'Bearer mock-session-jwt' },
    });
    assert.equal(response.status, 403);
  });

  it('GET /api/strategy/events succeeds with wallet-connected Clerk user', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({
      watchlistPath,
      apiAccessMiddleware: clerkMiddleware({ walletConnected: true }),
    });

    const response = await fetch(`${baseUrl}/api/strategy/events`, {
      headers: { Authorization: 'Bearer mock-session-jwt' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.events));
  });

  it('GET /api/auth/config returns Clerk client config shape', async () => {
    const watchlistPath = await tempWatchlistPath();
    await startServer({ watchlistPath });
    const response = await fetch(`${baseUrl}/api/auth/config`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok('publishableKey' in body);
    assert.ok('clerkEnabled' in body);
  });
});
