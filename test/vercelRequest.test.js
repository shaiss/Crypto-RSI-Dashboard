const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { restorePublicUrlMiddleware } = require('../lib/vercelRequest');

describe('restorePublicUrlMiddleware', () => {
  it('rewrites /api/index to forwarded path on Vercel', () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = '1';

    const req = {
      url: '/api/index?token=BTC',
      headers: { 'x-vercel-original-url': '/api/auth/config' },
    };
    let called = false;
    restorePublicUrlMiddleware(req, {}, () => {
      called = true;
    });

    assert.equal(called, true);
    assert.equal(req.url, '/api/auth/config?token=BTC');

    if (previous === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previous;
    }
  });

  it('no-ops outside Vercel', () => {
    const previous = process.env.VERCEL;
    delete process.env.VERCEL;

    const req = {
      url: '/api/index',
      headers: { 'x-vercel-original-url': '/api/auth/config' },
    };
    restorePublicUrlMiddleware(req, {}, () => {});
    assert.equal(req.url, '/api/index');

    if (previous !== undefined) {
      process.env.VERCEL = previous;
    }
  });
});
