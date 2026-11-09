import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestNumber } from '../../backend/src/core/lending/request-number.js';

test('request numbers use Bangkok calendar time and five random characters', () => {
  const now = new Date('2026-11-06T18:04:05Z');
  for (const kind of ['L', 'R']) {
    const id = createRequestNumber(kind, [], now);
    assert.match(id, new RegExp(`^STeP-IQI-${kind}20261107-010405-[A-Z0-9]{5}$`));
    assert.notEqual(createRequestNumber(kind, [[id]], now), id);
  }
});
