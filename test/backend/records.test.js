import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Records } from '../../backend/src/services/records.js';
import { parseSheet } from '../../backend/src/services/searchService.js';
function setup() {
  const rows = [
    ['รายการ', 'เลขครุภัณฑ์', 'หมายเหตุ', 'สูตร'],
    ['Monitor', '207-007', '', '=1+1'],
    ['Keyboard', '207-008', '', '=2+2'],
  ];
  const config = {
    sheets: ['IQI', 'รายการทั้งหมด', 'all'],
    dateHeader: 'หมายเหตุ',
    dateMode: 'inspection-note',
  };
  const writes = [];
  const adapter = {
    initialize: async () => {},
    read: async (names = config.sheets) => names.map((n) => parseSheet(n, structuredClone(rows))),
    writeIQI: async (row, changes) => {
      writes.push(changes);
      for (const c of changes) rows[row - 1][c.index] = c.value;
    },
  };
  return { service: new Records(adapter, config), rows, writes };
}
test('saves only changed IQI cells and returns freshly read values', async () => {
  const { service, writes } = setup();
  const record = await service.detail('IQI', 2);
  const values = [...record.values];
  values[2] = 'วันที่ตรวจสอบ 20/10/2569';
  const result = await service.save(2, { revision: record.revision, values });
  assert.equal(result.values[2], values[2]);
  assert.deepEqual(writes[0], [{ index: 2, value: values[2] }]);
  await assert.rejects(() => service.save(2, { revision: record.revision, values }), {
    status: 409,
  });
});
test('rejects wrong sheet, forged token, changed row and reordered headers', async () => {
  const { service, rows, writes } = setup();
  const record = await service.detail('IQI', 2);
  await assert.rejects(
    () => service.save(2, { sheet: 'all', revision: record.revision, values: record.values }),
    { status: 403 },
  );
  await assert.rejects(() => service.save(2, { revision: 'fake', values: record.values }), {
    status: 409,
  });
  rows[1][0] = 'Changed elsewhere';
  await assert.rejects(
    () => service.save(2, { revision: record.revision, values: record.values }),
    { status: 409 },
  );
  const fresh = await service.detail('IQI', 2);
  rows[0].reverse();
  await assert.rejects(() => service.save(2, { revision: fresh.revision, values: fresh.values }), {
    status: 409,
  });
  assert.equal(writes.length, 0);
});
test('rejects rows moved by sorting and exact duplicate row snapshots', async () => {
  const { service, rows } = setup();
  const record = await service.detail('IQI', 2);
  [rows[1], rows[2]] = [rows[2], rows[1]];
  await assert.rejects(
    () => service.save(2, { revision: record.revision, values: record.values }),
    { status: 409 },
  );
  rows[2] = [...rows[1]];
  const fresh = await service.detail('IQI', 2);
  await assert.rejects(() => service.save(2, { revision: fresh.revision, values: fresh.values }), {
    status: 409,
  });
});
test('detail returns live dropdowns and save validates the latest sheet rules', async () => {
  const { service, writes } = setup();
  let options = ['original', 'allowed'];
  service.adapter.getDropdowns = async () => [
    null,
    null,
    { options: [...options], strict: true },
    null,
  ];
  const record = await service.detail('IQI', 2);
  assert.deepEqual(record.dropdowns[2].options, options);
  const values = [...record.values];
  values[2] = 'allowed';
  options = ['changed rule'];
  await assert.rejects(() => service.save(2, { revision: record.revision, values }), {
    status: 422,
  });
  assert.equal(writes.length, 0);
  values[2] = 'changed rule';
  const saved = await service.save(2, { revision: record.revision, values });
  assert.equal(saved.values[2], 'changed rule');
});
