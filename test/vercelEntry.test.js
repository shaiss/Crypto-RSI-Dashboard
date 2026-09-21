const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');

describe('Vercel serverless entry', () => {
  it('api/index.js exports the Express app with /api/auth/config registered', () => {
    const vercelApp = require('../api/index');
    const localApp = require('../index');
    assert.equal(vercelApp, localApp);

    const stack = localApp._router.stack;
    const layer = stack.find(
      (entry) => entry.route && entry.route.path === '/api/auth/config',
    );
    assert.ok(layer, 'expected GET /api/auth/config route on exported app');
    assert.ok(layer.route.methods.get);
  });

  it('createApp registers API routes before static middleware', () => {
    const app = createApp({
      vercelRequestMiddleware: (_req, _res, next) => next(),
      apiAccessMiddleware: (_req, _res, next) => next(),
    });
    const stack = app._router.stack;
    const authIndex = stack.findIndex(
      (entry) => entry.route && entry.route.path === '/api/auth/config',
    );
    const staticIndex = stack.findIndex(
      (entry) => entry.name === 'serveStatic',
    );
    assert.ok(authIndex >= 0);
    assert.ok(staticIndex >= 0);
    assert.ok(authIndex < staticIndex);
  });
});
