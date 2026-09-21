const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeStrategySignals,
  evaluateStrategyTransitions,
} = require('../lib/strategySignals');

describe('strategy signal evaluation', () => {
  it('computes buy and sell activeness', () => {
    assert.deepEqual(
      computeStrategySignals({ rsi: 25, buyBelow: 30, sellAbove: 70 }),
      { buy: true, sell: false },
    );
    assert.deepEqual(
      computeStrategySignals({ rsi: 80, buyBelow: 30, sellAbove: 70 }),
      { buy: false, sell: true },
    );
  });

  it('emits one buy event until RSI clears the threshold', () => {
    const openState = {};
    const first = evaluateStrategyTransitions(openState, {
      token: 'btc',
      timeframe: '1h',
      rsi: 28,
      buyBelow: 30,
      sellAbove: 70,
      walletAddress: '0xabc',
    });
    assert.equal(first.length, 1);
    assert.equal(first[0].side, 'buy');

    const second = evaluateStrategyTransitions(openState, {
      token: 'btc',
      timeframe: '1h',
      rsi: 27,
      buyBelow: 30,
      sellAbove: 70,
    });
    assert.equal(second.length, 0);

    const cleared = evaluateStrategyTransitions(openState, {
      token: 'btc',
      timeframe: '1h',
      rsi: 35,
      buyBelow: 30,
      sellAbove: 70,
    });
    assert.equal(cleared.length, 0);

    const again = evaluateStrategyTransitions(openState, {
      token: 'btc',
      timeframe: '1h',
      rsi: 29,
      buyBelow: 30,
      sellAbove: 70,
    });
    assert.equal(again.length, 1);
  });
});
