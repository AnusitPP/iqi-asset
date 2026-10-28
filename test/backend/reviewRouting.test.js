import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewDestination,
  ReviewQueues,
  IQI_IT_SHEET,
} from '../../backend/src/services/review/reviewQueues.js';
import { reviewKey, REVIEW_SHEET } from '../../backend/src/services/review/reviewQueue.js';
import { parseSheet } from '../../backend/src/services/searchService.js';
test('only team IQI with owner IT or truly blank routes to IQI + IT', () => {
  for (const [team, owner, wanted] of [
    ['IQI', 'IT', IQI_IT_SHEET],
    ['15.IQI', '', IQI_IT_SHEET],
    [' iqi ', ' it ', IQI_IT_SHEET],
    ['IT', 'IT', REVIEW_SHEET],
    ['IQI', 'Person', REVIEW_SHEET],
    ['IQI', '-', REVIEW_SHEET],
    ['CC', '', REVIEW_SHEET],
  ]) {
    const t = parseSheet('all', [
      ['เลขครุภัณฑ์', 'ชื่อ - นามสกุล', 'ทีม'],
      ['001', owner, team],
    ]);
    assert.equal(reviewDestination(t, t.records[0]), wanted);
  }
});
test('existing copy wins over new routing; cross-tab duplicates are rejected', async () => {
  const t = parseSheet('all', [
      ['เลขครุภัณฑ์', 'ชื่อ - นามสกุล', 'ทีม'],
      ['001', 'IT', 'IQI'],
    ]),
    r = t.records[0],
    key = reviewKey(t, r);
  const queues = [REVIEW_SHEET, IQI_IT_SHEET].map((sheet) => ({ sheet }));
  const manager = new ReviewQueues({}, queues);
  manager.read = async () => ({ entries: [] });
  assert.equal((await manager.locate(t, r)).sheet, IQI_IT_SHEET);
  manager.read = async () => ({ entries: [{ key, queueSheet: REVIEW_SHEET }] });
  assert.equal((await manager.locate(t, r)).sheet, REVIEW_SHEET);
  manager.read = async () => ({ entries: queues.map((q) => ({ key, queueSheet: q.sheet })) });
  await assert.rejects(() => manager.locate(t, r), { status: 409 });
});
