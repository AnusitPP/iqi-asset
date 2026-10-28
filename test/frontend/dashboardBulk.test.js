import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveStatusDrafts } from '../../frontend/public/js/features/dashboard/dashboardBulk.js';

test('bulk save processes every draft, retains failures and removes only successes', async () => {
  const drafts = new Map([
    [2, { status: 'ดี', revision: 'a' }],
    [3, { status: 'ชำรุด', revision: 'b' }],
    [4, { status: 'อุปกรอื่นๆ', revision: 'c' }],
  ]);
  const calls = [];
  const result = await saveStatusDrafts(drafts, async (row, draft) => {
    calls.push([row, draft.status]);
    if (row === 3) throw new Error('ข้อมูลเปลี่ยนไปแล้ว');
    return { record: { row, inspection: draft.status } };
  });
  assert.deepEqual(
    calls.map((c) => c[0]),
    [2, 3, 4],
  );
  assert.equal(result.saved.length, 2);
  assert.equal(result.failed[0].row, 3);
  assert.deepEqual([...drafts.keys()], [3]);
});

test('bulk save stops after invalidation and preserves newer edits', async () => {
  const drafts = new Map([
    [2, { status: 'ดี', revision: 'a' }],
    [3, { status: 'ดี', revision: 'b' }],
  ]);
  let current = true;
  const newer = { status: 'ชำรุด', revision: 'new' };
  const result = await saveStatusDrafts(
    drafts,
    async () => {
      drafts.set(2, newer);
      current = false;
      return {};
    },
    { isCurrent: () => current },
  );
  assert.equal(result.saved.length, 1);
  assert.equal(drafts.get(2), newer);
  assert.ok(drafts.has(3));
});
