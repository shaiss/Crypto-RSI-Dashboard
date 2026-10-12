const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');
const { createHeatmapDataGuard } = require('../lib/heatmapData');

function get(app, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers });
        const body = res.status === 204 ? null : await res.json();
        resolve({ status: res.status, body });
      } catch (e) { reject(e); } finally { server.close(); }
    });
  });
}

const base = { apiAccessMiddleware: (req, res, next) => next(), vercelRequestMiddleware: (req, res, next) => next() };

describe('GET /api/heatmap-data', () => {
  let heatmapGuard;

  beforeEach(() => {
    heatmapGuard = createHeatmapDataGuard();
  });

  it('returns token RSI points', async () => {
    const app = createApp({
      ...base,
      heatmapDataGuard,
      taapiSecret: 'k',
      fetchRSI: async ({ symbol }) => (symbol.startsWith('ETH') ? Promise.reject(new Error('x')) : { value: 42 }),
    });
    const { status, body } = await get(app, '/api/heatmap-data');
    assert.equal(status, 200);
    assert.ok(body.length >= 1);
    assert.deepEqual(body[0], { token: 'BTC', rsi: 42 });
    assert.ok(!body.some((r) => r.token === 'ETH'));
  });

  it('503 without TAAPI secret', async () => {
    const app = createApp({ ...base, heatmapDataGuard, taapiSecret: '' });
    const { status } = await get(app, '/api/heatmap-data');
    assert.equal(status, 503);
  });

  it('serves cached payload without re-fetching TAAPI', async () => {
    let fetchCount = 0;
    const app = createApp({
      ...base,
      heatmapDataGuard,
      taapiSecret: 'k',
      fetchRSI: async () => {
        fetchCount += 1;
        return { value: 50 };
      },
    });
    const first = await get(app, '/api/heatmap-data');
    const second = await get(app, '/api/heatmap-data');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(fetchCount, 5);
  });

  it('returns 429 when per-IP rate limit is exceeded', async () => {
    const limitedGuard = createHeatmapDataGuard({ rateLimitMax: 1, rateLimitWindowMs: 60_000 });
    const app = createApp({
      ...base,
      heatmapDataGuard: limitedGuard,
      taapiSecret: 'k',
      fetchRSI: async () => ({ value: 40 }),
    });
    const ok = await get(app, '/api/heatmap-data', { 'x-forwarded-for': '203.0.113.10' });
    const blocked = await get(app, '/api/heatmap-data', { 'x-forwarded-for': '203.0.113.10' });
    assert.equal(ok.status, 200);
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: 'Too many requests' });
  });
});
