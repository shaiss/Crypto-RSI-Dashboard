const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createFileStrategyEventsStore } = require('../lib/strategyEvents');

describe('strategy events store (file)', () => {
  it('persists idempotent paper events', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strategy-events-'));
    const filePath = path.join(dir, 'strategy-events.json');
    const store = createFileStrategyEventsStore(filePath);

    const first = await store.recordSessionEvaluation({
      token: 'BTC',
      timeframe: '1h',
      rsi: 25,
      buyBelow: 30,
      sellAbove: 70,
      walletAddress: '0xwallet',
    });
    assert.equal(first.length, 1);

    const repeat = await store.recordSessionEvaluation({
      token: 'BTC',
      timeframe: '1h',
      rsi: 24,
      buyBelow: 30,
      sellAbove: 70,
      walletAddress: '0xwallet',
    });
    assert.equal(repeat.length, 0);

    const listed = await store.list({ token: 'BTC', timeframe: '1h' });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].side, 'buy');
  });
});
