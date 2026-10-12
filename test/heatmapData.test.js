const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');

function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
        resolve({ status: res.status, body: await res.json() });
      } catch (e) { reject(e); } finally { server.close(); }
    });
  });
}

const base = { apiAccessMiddleware: (req, res, next) => next(), vercelRequestMiddleware: (req, res, next) => next() };

describe('GET /api/heatmap-data', () => {
  it('returns token RSI points', async () => {
    const app = createApp({ ...base, taapiSecret: 'k', fetchRSI: async ({ symbol }) => (symbol.startsWith('ETH') ? Promise.reject(new Error('x')) : { value: 42 }) });
    const { status, body } = await get(app, '/api/heatmap-data');
    assert.equal(status, 200);
    assert.ok(body.length >= 1);
    assert.deepEqual(body[0], { token: 'BTC', rsi: 42 });
    assert.ok(!body.some((r) => r.token === 'ETH'));
  });
  it('503 without TAAPI secret', async () => {
    const app = createApp({ ...base, taapiSecret: '' });
    const { status } = await get(app, '/api/heatmap-data');
    assert.equal(status, 503);
  });
});
