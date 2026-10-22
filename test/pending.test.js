import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Records } from '../src/records.js';
import { parseSheet } from '../src/searchService.js';
function setup() {
  const rows = [
    ['เลขครุภัณฑ์', 'รายการ', 'สถานะการค้นหา'],
    ['207-007', 'A', ''],
    ['107-002', 'B', 'รอค้นหา'],
  ];
  const writes = [];
  const config = { sheets: ['IQI', 'รายการทั้งหมด', 'all'] };
  const adapter = {
    read: async (names = config.sheets) =>
      names.map((name) => parseSheet(name, structuredClone(rows))),
    writeIQI: async (row, changes) => {
      writes.push({ row, changes });
      for (const c of changes) rows[row - 1][c.index] = c.value;
    },
  };
  return { service: new Records(adapter, config), rows, writes };
}
test('pending checkbox intersects search and lists all marked IQI rows for empty query', async () => {
  const { service } = setup();
  const all = await service.search('', { pendingOnly: true });
  assert.deepEqual(
    all.groups.map((g) => g.count),
    [1, 0, 0],
  );
  assert.equal(all.groups[0].records[0].pending, true);
  assert.ok(all.groups[0].records[0].revision);
  assert.deepEqual(
    (await service.search('207', { pendingOnly: true })).groups.map((g) => g.count),
    [0, 0, 0],
  );
  assert.equal((await service.search('0')).groups[0].count, 2);
  await assert.rejects(() => service.search(''), { status: 400 });
});
test('heart writes only status, verifies revision and supports clearing to blank', async () => {
  const { service, rows, writes } = setup();
  const record = (await service.search('207')).groups[0].records[0];
  const saved = await service.setPending(record.row, { revision: record.revision, pending: true });
  assert.equal(saved.values[2], 'รอค้นหา');
  assert.deepEqual(writes[0].changes, [{ index: 2, value: 'รอค้นหา' }]);
  await assert.rejects(
    () => service.setPending(record.row, { revision: record.revision, pending: false }),
    { status: 409 },
  );
  const restored = await service.setPending(record.row, {
    revision: saved.revision,
    pending: false,
  });
  assert.equal(restored.values[2], '');
  assert.equal(rows[1][1], 'A');
});
test('rejects forged targets, malformed state, and moved rows without writing', async () => {
  const { service, rows, writes } = setup();
  const record = (await service.search('207')).groups[0].records[0];
  await assert.rejects(
    () =>
      service.setPending(record.row, { sheet: 'all', revision: record.revision, pending: true }),
    { status: 403 },
  );
  await assert.rejects(
    () => service.setPending(record.row, { revision: record.revision, pending: 'true' }),
    { status: 400 },
  );
  [rows[1], rows[2]] = [rows[2], rows[1]];
  await assert.rejects(
    () => service.setPending(record.row, { revision: record.revision, pending: true }),
    { status: 409 },
  );
  assert.equal(writes.length, 0);
});
test('every heart token in a result with more than 2000 IQI rows remains usable', async () => {
  const { service, rows } = setup();
  rows.splice(1, 2, ...Array.from({ length: 2001 }, (_, i) => [`ASSET-${i}`, 'Item', 'รอค้นหา']));
  const result = await service.search('', { pendingOnly: true });
  assert.equal(result.groups[0].count, 2001);
  const first = result.groups[0].records[0];
  const saved = await service.setPending(first.row, { revision: first.revision, pending: false });
  assert.equal(saved.values[2], '');
});
