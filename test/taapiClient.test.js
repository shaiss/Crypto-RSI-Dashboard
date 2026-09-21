const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRsiSeriesPayload } = require('../lib/taapiClient');

describe('normalizeRsiSeriesPayload', () => {
  it('wraps a single numeric value', () => {
    const points = normalizeRsiSeriesPayload({ value: 44.2, timestamp: 1700000000 });
    assert.equal(points.length, 1);
    assert.equal(points[0].value, 44.2);
    assert.equal(points[0].timestamp, 1700000000);
  });

  it('parses parallel value/timestamp arrays', () => {
    const points = normalizeRsiSeriesPayload({
      value: [40, 41, 42],
      timestamp: [1, 2, 3],
    });
    assert.deepEqual(points.map((p) => p.value), [40, 41, 42]);
    assert.deepEqual(points.map((p) => p.timestamp), [1, 2, 3]);
  });
});
