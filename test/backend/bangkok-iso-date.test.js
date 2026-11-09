import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokIsoDate } from '../../shared/core/extensions/dates.js';
test('shared ISO date follows Bangkok midnight and year rollover', () => {
  assert.equal(bangkokIsoDate(new Date('2026-12-31T16:59:59Z')), '2026-12-31');
  assert.equal(bangkokIsoDate(new Date('2026-12-31T17:00:00Z')), '2027-01-01');
});
