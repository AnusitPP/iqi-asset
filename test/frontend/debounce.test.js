import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { debounce } from '../../frontend/public/js/core/functions/debounce.js';
test('typing searches only latest text and manual search can cancel queued work', async () => {
  const calls = [];
  const search = debounce((value) => calls.push(value), 10);
  search('0');
  search('00');
  search('007');
  await wait(40);
  assert.deepEqual(calls, ['007']);
  search('1');
  search.cancel();
  await wait(40);
  assert.deepEqual(calls, ['007']);
});
