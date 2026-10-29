import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewQueue,
  REVIEW_HEADERS,
  REVIEW_SHEET,
} from '../../backend/src/features/review/queue.js';
import { parseSheet } from '../../backend/src/features/records/search.js';
import { Records } from '../../backend/src/features/records/service.js';
import { ReviewQueues, IQI_IT_SHEET } from '../../backend/src/features/review/queues.js';
function setup(multi = false) {
  const config = { sheets: ['IQI', 'รายการทั้งหมด', 'all'], spreadsheetId: 'test' };
  const headers = [
    'รายการ',
    'ชื่อ - นามสกุล',
    'ชื่อเล่น',
    'ชื่อย่อ',
    'ทีม',
    'ยี่ห้อ',
    'S/N',
    'เลขครุภัณฑ์',
    'รายละเอียด',
    'สถานะการค้นหา',
  ];
  let grids = {
    IQI: [headers, ['Monitor', 'Name', 'Nick', 'NN', 'IQI', 'Brand', 'SN', '001', 'Detail', '']],
    รายการทั้งหมด: [
      headers,
      ['Mouse', 'Other', 'O', 'OO', 'GA', 'B', 'SN2', '001', 'Description', ''],
    ],
    all: [
      [
        'อุปกรณ์',
        'ชื่อ - นามสกุล',
        'ชื่อเล่น',
        'ชื่อย่อ',
        'ทีม',
        'Brand',
        'Serial Number (S/N)',
        'เลขครุภัณฑ์',
        'รายละเอียด',
      ],
      ['Printer', 'Full', 'N', 'F', 'IT', 'HP', 'SN3', '001', 'Text'],
      ['Keyboard', 'Full', 'N', 'F', 'IT', 'HP', 'SN4', '002', 'Other'],
    ],
  };
  grids[REVIEW_SHEET] = [[...REVIEW_HEADERS]];
  if (multi) grids[IQI_IT_SHEET] = [[...REVIEW_HEADERS]];
  const names = [...config.sheets, REVIEW_SHEET, ...(multi ? [IQI_IT_SHEET] : [])];
  const writes = [],
    formats = {};
  let failWrite = false;
  const properties = names.map((title, i) => ({
    sheetId: i + 1,
    title,
    gridProperties: { rowCount: 100, columnCount: 12 },
  }));
  const adapter = {
    config,
    api: {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: properties.map((properties) => ({
              properties,
              conditionalFormats: formats[properties.sheetId] || [],
            })),
          },
        }),
        values: {
          get: async ({ valueRenderOption }) => ({
            data: {
              values: structuredClone(grids[REVIEW_SHEET]).map((row) =>
                row.map((v) =>
                  valueRenderOption !== 'FORMULA' && typeof v === 'string' && v.startsWith('=')
                    ? ''
                    : v,
                ),
              ),
            },
          }),
        },
        batchUpdate: async ({ requestBody }) => {
          if (failWrite) throw new Error('Injected batch failure');
          for (const request of requestBody.requests) {
            const add = request.addConditionalFormatRule,
              del = request.deleteConditionalFormatRule;
            if (add) {
              const id = add.rule.ranges[0].sheetId;
              (formats[id] ??= []).splice(add.index, 0, structuredClone(add.rule));
            }
            if (del) formats[del.sheetId].splice(del.index, 1);
          }
          const next = structuredClone(grids);
          for (const { updateCells: u } of requestBody.requests) {
            if (!u) continue;
            const r = u.range;
            const name = names[r.sheetId - 1];
            next[name][r.startRowIndex] ??= [];
            u.rows[0].values.forEach((cell, i) => {
              next[name][r.startRowIndex][r.startColumnIndex + i] =
                cell.userEnteredValue?.stringValue ?? cell.userEnteredValue?.numberValue ?? '';
            });
          }
          grids = next;
          writes.push(requestBody.requests);
        },
      },
    },
  };
  const queue = new ReviewQueue(adapter);
  queue.properties = properties[3];
  adapter.reviewQueue = queue;
  adapter.read = async (sheets = config.sheets) =>
    sheets.map((name) => parseSheet(name, structuredClone(grids[name])));
  adapter.readReviewQueue = () => queue.read();
  adapter.setReviewSelection = (...args) => queue.setSelection(...args);
  adapter.writeIQIAndReview = (...args) => queue.applyChanges(...args);
  let secondary;
  if (multi) {
    const render = (range, mode) =>
      structuredClone(grids[range.slice(1, -1).replaceAll("''", "'")]).map((row) =>
        row.map((v) => (mode !== 'FORMULA' && typeof v === 'string' && v.startsWith('=') ? '' : v)),
      );
    adapter.api.spreadsheets.values.get = async ({ range, valueRenderOption }) => ({
      data: { values: render(range, valueRenderOption) },
    });
    adapter.api.spreadsheets.values.batchGet = async ({ ranges, valueRenderOption }) => ({
      data: { valueRanges: ranges.map((range) => ({ values: render(range, valueRenderOption) })) },
    });
    secondary = new ReviewQueue(adapter, IQI_IT_SHEET);
    secondary.properties = properties[4];
    const manager = new ReviewQueues(adapter, [queue, secondary]);
    adapter.readReviewQueues = () => manager.read();
    adapter.setReviewSelection = (...args) => manager.setSelection(...args);
    adapter.writeIQIAndReview = (...args) => manager.applyChanges(...args);
    adapter.reviewInspection = (...args) => manager.inspection(...args);
  }
  return {
    service: new Records(adapter, config),
    queue,
    secondary,
    writes,
    grids: () => grids,
    fail: () => {
      failWrite = true;
    },
    recover: () => {
      failWrite = false;
    },
  };
}
test('readonly source copies all nine fields, repeated marking is idempotent, and unmark removes only queue data', async () => {
  const f = setup(),
    before = structuredClone(f.grids().all);
  const record = (await f.service.search('001')).groups[2].records[0];
  const saved = await f.service.setReviewPending('all', 2, {
    sheet: 'all',
    revision: record.revision,
    pending: true,
  });
  assert.equal(saved.pending, true);
  assert.deepEqual((await f.queue.read()).entries[0].values, [
    'Printer',
    'Full',
    'N',
    'F',
    'IT',
    'HP',
    'SN3',
    '001',
    'Text',
  ]);
  assert.deepEqual(f.grids().all, before);
  const same = await f.service.setReviewPending('all', 2, {
    revision: saved.revision,
    pending: true,
  });
  assert.equal((await f.queue.read()).entries.length, 1);
  const pending = await f.service.search('', { pendingOnly: true });
  assert.deepEqual(
    pending.groups.map((g) => g.count),
    [0, 0, 1],
  );
  await f.service.setReviewPending('all', 2, { revision: same.revision, pending: false });
  assert.equal((await f.queue.read()).entries.length, 0);
  assert.deepEqual(f.grids().all, before);
});
test('IQI status and queued copy are atomic; editing marked IQI fields refreshes the same queue entry', async () => {
  const f = setup();
  const record = (await f.service.search('001')).groups[0].records[0];
  f.fail();
  await assert.rejects(() =>
    f.service.setReviewPending('IQI', 2, { revision: record.revision, pending: true }),
  );
  assert.equal(f.grids().IQI[1][9], '');
  assert.equal((await f.queue.read()).entries.length, 0);
  f.recover();
  const saved = await f.service.setReviewPending('IQI', 2, {
    revision: record.revision,
    pending: true,
  });
  assert.equal(saved.values[9], 'รอค้นหา');
  assert.equal(f.writes[0].length, 2);
  const values = [...saved.values];
  values[0] = 'Updated monitor';
  await f.service.save(2, { revision: saved.revision, values });
  const entries = (await f.queue.read()).entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].values[0], 'Updated monitor');
});
test('different sources with the same asset number stay separate and tokens cannot cross source sheets', async () => {
  const f = setup();
  const result = await f.service.search('001');
  for (const group of result.groups) {
    const record = group.records[0];
    await f.service.setReviewPending(group.sheet, record.row, {
      revision: record.revision,
      pending: true,
    });
  }
  assert.equal((await f.queue.read()).entries.length, 3);
  const fresh = await f.service.search('001');
  const other = fresh.groups[2].records[0];
  await assert.rejects(() => f.service.save(2, { revision: other.revision, values: [] }), {
    status: 409,
  });
  await assert.rejects(
    () => f.service.setReviewPending('IQI', 2, { revision: other.revision, pending: false }),
    { status: 409 },
  );
});
test('a queue row containing a formula displayed as empty is never reused', async () => {
  const f = setup();
  f.grids()[REVIEW_SHEET].push(['=IF(TRUE,"","")']);
  const record = (await f.service.search('001')).groups[2].records[0];
  await f.service.setReviewPending('all', 2, { revision: record.revision, pending: true });
  assert.equal(f.grids()[REVIEW_SHEET][1][0], '=IF(TRUE,"","")');
  assert.equal((await f.queue.read()).entries[0].row, 3);
});
test('existing target formulas prevent an apparently empty sheet from being initialized', async () => {
  const f = setup();
  f.grids()[REVIEW_SHEET] = [['=IF(TRUE,"","")']];
  await assert.rejects(() => f.queue.ensure(), { status: 422 });
  assert.equal(f.writes.length, 0);
});

test('heart selection does not stamp dates; repeated selection and removal keep inspection separate', async () => {
  const f = setup();
  const record = (await f.service.search('001')).groups[2].records[0];
  const saved = await f.service.setReviewPending('all', 2, {
    revision: record.revision,
    pending: true,
  });
  const stamp = f.grids()[REVIEW_SHEET][1][12];
  assert.equal(stamp, undefined);
  const same = await f.service.setReviewPending('all', 2, {
    revision: saved.revision,
    pending: true,
  });
  assert.equal(f.grids()[REVIEW_SHEET][1][12], stamp);
  await f.service.setReviewPending('all', 2, { revision: same.revision, pending: false });
  assert.equal(f.grids()[REVIEW_SHEET][1][12], '');
});

test('adding the date header leaves legacy entries undated and later edits do not backfill them', async () => {
  const f = setup();
  const record = (await f.service.search('001')).groups[0].records[0];
  const saved = await f.service.setReviewPending('IQI', 2, {
    revision: record.revision,
    pending: true,
  });
  const before = structuredClone(f.grids()[REVIEW_SHEET][1]);
  await f.queue.ensure();
  assert.equal(f.grids()[REVIEW_SHEET][0][12], 'วันที่แก้ไข');
  assert.deepEqual(f.grids()[REVIEW_SHEET][1], before);
  const values = [...saved.values];
  values[0] = 'New description';
  await f.service.save(2, { revision: saved.revision, values });
  assert.equal(f.grids()[REVIEW_SHEET][1][12], undefined);
  const count = f.writes.length;
  await f.queue.ensure();
  assert.equal(f.writes.length, count);
});

test('inspection writes status and date only, rejects stale updates and leaves heart/source separate', async () => {
  const f = setup();
  await f.queue.ensure();
  const record = (await f.service.search('001')).groups[2].records[0];
  const marked = await f.service.setReviewPending('all', 2, {
    revision: record.revision,
    pending: true,
  });
  const body = { revision: marked.revision };
  const blank = await f.service.reviewInspection('all', 2, body);
  assert.equal(blank.status, '');
  assert.equal(blank.date, '');
  const before = structuredClone(f.grids());
  await assert.rejects(
    () => f.service.reviewInspection('all', 2, { ...body, ...blank, status: 'อื่น' }, true),
    { status: 400 },
  );
  await assert.rejects(() => f.service.reviewInspection('IQI', 2, body), { status: 409 });
  const saved = await f.service.reviewInspection(
    'all',
    2,
    { ...body, ...blank, status: 'ดี' },
    true,
  );
  assert.equal(saved.status, 'ดี');
  assert.ok(Number(f.grids()[REVIEW_SHEET][1][12]) > 45000);
  assert.equal((await f.service.search('001')).groups[2].records[0].inspected, true);
  assert.equal((await f.service.search('001')).groups[2].records[0].inspectionStatus, 'ดี');
  assert.deepEqual(f.grids().all, before.all);
  assert.deepEqual(f.grids()[REVIEW_SHEET][1].slice(0, 12), before[REVIEW_SHEET][1].slice(0, 12));
  await assert.rejects(
    () => f.service.reviewInspection('all', 2, { ...body, ...blank, status: 'ชำรุด' }, true),
    { status: 409 },
  );
  const fresh = await f.service.reviewInspection('all', 2, body);
  const stamp = f.grids()[REVIEW_SHEET][1][12];
  const same = await f.service.reviewInspection(
    'all',
    2,
    { ...body, ...fresh, status: 'ดี' },
    true,
  );
  assert.equal(same.unchanged, true);
  assert.equal(f.grids()[REVIEW_SHEET][1][12], stamp);
  await f.service.reviewInspection('all', 2, { ...body, ...fresh, status: 'หาไม่เจอ' }, true);
  assert.equal(f.grids()[REVIEW_SHEET][1][13], 'หาไม่เจอ');
  assert.equal((await f.service.search('001')).groups[2].records[0].inspectionStatus, 'หาไม่เจอ');
  await f.service.setReviewPending('all', 2, { revision: marked.revision, pending: false });
  assert.equal(f.grids()[REVIEW_SHEET][1][13], '');
  assert.equal((await f.service.search('001')).groups[2].records[0].inspected, false);
});

test('routed hearts, fourth search group, inspections and removal all use the actual destination', async () => {
  const f = setup(true);
  await f.queue.ensure();
  await f.secondary.ensure();
  f.grids().IQI[1][1] = 'IT';
  const result = await f.service.search('001'),
    record = result.groups[0].records[0];
  const saved = await f.service.setReviewPending('IQI', 2, {
    revision: record.revision,
    pending: true,
  });
  assert.equal(saved.reviewSheet, IQI_IT_SHEET);
  assert.equal((await f.queue.read()).entries.length, 0);
  assert.equal((await f.secondary.read()).entries.length, 1);
  assert.equal(f.grids()[IQI_IT_SHEET][1][12], undefined);
  const again = await f.service.setReviewPending('IQI', 2, {
    revision: saved.revision,
    pending: true,
  });
  assert.equal((await f.secondary.read()).entries.length, 1);
  const found = await f.service.search('001'),
    group = found.groups.find((g) => g.reviewGroup);
  assert.equal(group.label, 'IT + IQI');
  assert.equal(group.records[0].sourceSheet, 'IQI');
  assert.equal(found.groups[0].count, 0);
  const initial = await f.service.reviewInspection('IQI', 2, { revision: again.revision });
  await f.service.reviewInspection(
    'IQI',
    2,
    { revision: again.revision, ...initial, status: 'ชำรุด' },
    true,
  );
  assert.equal(f.grids()[IQI_IT_SHEET][1][13], 'ชำรุด');
  assert.equal((await f.queue.read()).entries.length, 0);
  const values = [...again.values];
  values[8] = 'Edited source detail';
  const edited = await f.service.save(2, { revision: again.revision, values });
  assert.equal(f.grids()[IQI_IT_SHEET][1][8], 'Edited source detail');
  assert.equal(f.grids()[IQI_IT_SHEET][1][13], 'ชำรุด');
  await f.service.setReviewPending('IQI', 2, { revision: edited.revision, pending: false });
  assert.equal((await f.secondary.read()).entries.length, 0);
  const other = (await f.service.search('001')).groups[2].records[0];
  const ordinary = await f.service.setReviewPending('all', 2, {
    revision: other.revision,
    pending: true,
  });
  assert.equal(ordinary.reviewSheet, REVIEW_SHEET);
});
