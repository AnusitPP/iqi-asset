import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCatalog } from '../../shared/features/catalog/search.js';
test('catalog searches name asset serial and requires all query words', () => {
  const r = [
    { asset: 'A1', serial: 'SN9', name: 'จอ Samsung' },
    { asset: 'B1', serial: '', name: 'Keyboard' },
  ];
  assert.deepEqual(matchCatalog(r, 'samsung a1'), [r[0]]);
  assert.deepEqual(matchCatalog(r, 'sn9'), [r[0]]);
  assert.deepEqual(matchCatalog(r, 'ตู้'), []);
});
