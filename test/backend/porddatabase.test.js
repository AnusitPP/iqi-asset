import test from 'node:test';
import assert from 'node:assert/strict';
import { PordDatabase, PORD_HEADERS } from '../../backend/src/features/porddatabase/service.js';
import { StateStore } from '../../backend/src/core/state/stateStore.js';
import { pdfReference } from '../../backend/src/features/porddatabase/pdf-reference.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';

function fixture() {
  const source = [
    [
      'ผลตรวจ Apps Script',
      'สถานะการเทียบ',
      'เลขครุภัณฑ์ Apps Script',
      'ชื่ออุปกรณ์ Apps Script',
      'S/N Apps Script',
      'S/N ในชีต',
    ],
    ['ดี', 'ตรงกัน', 'STeP61-107-064', 'Laptop', '', 'SN1'],
    ['ดี', 'ตรงกัน', 'A2', 'Monitor', 'SN2', ''],
  ];
  const destination = [];
  const adapter = {
    state: new StateStore(),
    config: { spreadsheetId: 'test' },
    readDashboard: async () => structuredClone(source),
    readPordDatabase: async () => structuredClone(destination),
    appendPordDatabase: async (rows, headers) => {
      if (!destination.length) destination.push(headers);
      destination.push(...rows);
    },
  };
  return { service: new PordDatabase(adapter), source, destination, adapter };
}
const choose = (r) => ({
  ...r,
  name: 'Edited name',
  asset: r.asset,
});

test('excludes only the designated ready-to-borrow asset and rejects stale drafts before writing', async () => {
  const { service, source, destination } = fixture();
  source.push(['ดี', 'ตรงกัน', ' STeP61-107-041 ', 'ACER SWIFT', 'SN3', '']);
  const before = structuredClone(source);
  const records = (await service.read()).records;
  assert.equal(
    records.some((r) => r.sourceId === 'STEP61-107-041'),
    false,
  );
  assert.ok(records.some((r) => r.sourceId === 'A2'));
  await assert.rejects(
    service.send({
      records: [
        {
          ...choose(records[0]),
          sourceId: 'STEP61-107-041',
          asset: 'STeP61-107-041',
        },
      ],
    }),
    { status: 400 },
  );
  assert.deepEqual(destination, []);
  assert.deepEqual(source, before);
});

test('fills missing source photo links from matching Drive images without writing either sheet', async () => {
  const { adapter, source, destination } = fixture();
  const before = structuredClone(source);
  const store = {
    folder: 'root',
    drive: {
      files: {
        list: async ({ q }) => ({
          data: {
            files: q.includes("'root'")
              ? [
                  {
                    id: 'asset-folder',
                    name: 'STeP61-107-064',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: ['root'],
                  },
                ]
              : [
                  {
                    id: 'photo1',
                    name: 'catalog_123.jpg',
                    mimeType: 'image/jpeg',
                    parents: ['asset-folder'],
                  },
                ],
          },
        }),
      },
    },
  };
  const records = (await new PordDatabase(adapter, store).read()).records;
  assert.equal(records[0].photo, 'https://drive.google.com/file/d/photo1/view');
  assert.equal(records[0].appFields.photo, records[0].photo);
  assert.equal(records[0].drivePhoto, records[0].photo);
  assert.equal(records[1].photo, '');
  assert.deepEqual(source, before);
  assert.deepEqual(destination, []);
});

test('defaults to the existing owner for older clients and preserves owner edits without changing source', async () => {
  const { service, source, destination } = fixture();
  source[0].push('ชื่อผู้ถือครอง');
  source[1].push('ผู้ถือครองเดิม');
  source[2].push('เจ้าของจอ');
  const before = structuredClone(source);
  const records = (await service.read()).records.filter((r) => r.appMatched);
  assert.equal(records[0].owner, 'ผู้ถือครองเดิม');
  assert.equal(records[0].appFields.owner, 'ผู้ถือครองเดิม');
  const oldDraft = choose(records[0]);
  delete oldDraft.owner;
  await service.send({ records: [oldDraft, { ...choose(records[1]), owner: 'ผู้ถือครองใหม่' }] });
  assert.equal(destination[1][8], 'ผู้ถือครองเดิม');
  assert.equal(destination[2][8], 'ผู้ถือครองใหม่');
  assert.equal((await service.read()).records[1].owner, 'ผู้ถือครองใหม่');
  assert.deepEqual(source, before);
});

test('reads legacy eight-column destination and adds only the owner header when next appending', async () => {
  const { service, destination } = fixture();
  destination.push(PORD_HEADERS.slice(0, 8), ['OLD', '', 'Old item']);
  await service.read();
  assert.equal(destination[0].length, 8);
  const writes = [];
  const adapter = {
    config: { spreadsheetId: 'test' },
    readPordDatabase: async () => structuredClone(destination),
    api: {
      spreadsheets: {
        get: async () => ({ data: { sheets: [{ properties: { title: 'PORDDATABASE' } }] } }),
        values: {
          update: async (request) => writes.push(request),
          append: async (request) => writes.push(request),
        },
      },
    },
  };
  await GoogleSheets.prototype.appendPordDatabase.call(
    adapter,
    [['NEW', '', 'Name', '', '', '', '', '', 'Owner']],
    PORD_HEADERS,
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].range, "'PORDDATABASE'!I1");
  assert.deepEqual(writes[0].requestBody.values, [['ชื่อผู้ถือครอง']]);
  assert.equal(writes[1].range, "'PORDDATABASE'!A3:I3");
  assert.equal(writes[1].requestBody.values[0][8], 'Owner');
  assert.deepEqual(destination[1], ['OLD', '', 'Old item']);
});

test('PDF costs preserve decimals, low-value items and missing prices', () => {
  assert.equal(pdfReference['STEP62-107-029'].cost, '26525.3');
  assert.equal(pdfReference['STEP61-207-081'].cost, '300');
  assert.equal(pdfReference['STEP62-107-008'].cost, '');
});

test('cost comes only from PDF and remains blank for an unmatched source', async () => {
  const { service, destination } = fixture();
  const records = (await service.read()).records.filter((r) => r.appMatched).map(choose);
  await service.send({ records: records.map((r) => ({ ...r, cost: '999999' })) });
  assert.equal(destination[1][5], '26500');
  assert.equal(destination[2][5], '');
});

test('destination appends RAW values in the current sheet column order', async () => {
  const writes = [];
  const adapter = {
    config: { spreadsheetId: 'test' },
    readPordDatabase: async () => [PORD_HEADERS, ['OLD']],
    api: {
      spreadsheets: {
        get: async () => ({ data: { sheets: [{ properties: { title: 'PORDDATABASE' } }] } }),
        values: {
          update: async (request) => {
            writes.push(request);
          },
          append: async (request) => {
            writes.push(request);
          },
        },
      },
    },
  };
  await GoogleSheets.prototype.appendPordDatabase.call(
    adapter,
    [['NEW', '', 'Name', '', '', '123.45', '', 'https://example.com/photo']],
    PORD_HEADERS,
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].range, "'PORDDATABASE'!A3:I3");
  assert.equal(writes[0].valueInputOption, 'RAW');
  assert.equal(writes[0].requestBody.values[0][5], '123.45');
  assert.equal(writes[0].requestBody.values[0][7], 'https://example.com/photo');
});

test('pins sparse PORD writes to column A and preserves blank fields instead of inferring a table', async () => {
  const row = ['ASSET-NEW', '', 'Laptop', 'ดี', '', '', '17/11/69 16:00:00', '', 'Owner'];
  for (const current of [
    [],
    [PORD_HEADERS, ['OLD'], [], ['', '', '', '', '', '', 'old timestamp']],
  ]) {
    const writes = [];
    const adapter = {
      config: { spreadsheetId: 'test' },
      readPordDatabase: async () => current,
      api: {
        spreadsheets: {
          get: async () => ({ data: { sheets: [{ properties: { title: 'PORDDATABASE' } }] } }),
          values: {
            append: async () => assert.fail('Must not infer a Sheets table'),
            update: async (request) => writes.push(request),
          },
        },
      },
    };
    await GoogleSheets.prototype.appendPordDatabase.call(adapter, [row], PORD_HEADERS);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].range, current.length ? "'PORDDATABASE'!A5:I5" : "'PORDDATABASE'!A1:I2");
    assert.equal(writes[0].valueInputOption, 'RAW');
    assert.deepEqual(writes[0].requestBody.values.at(-1), row);
    assert.equal(writes[0].requestBody.values.at(-1)[0], 'ASSET-NEW');
    assert.equal(writes[0].requestBody.values.at(-1)[6], '17/11/69 16:00:00');
  }
});

test('reads every source without writing, preserves PDF flags and falls back to sheet serial', async () => {
  const { service, destination } = fixture();
  const result = await service.read();
  assert.equal(
    result.records.filter((r) => r.pdfGroups.length).length,
    Object.keys(pdfReference).length,
  );
  assert.equal(result.records.filter((r) => r.appMatched).length, 2);
  assert.equal(result.records[0].status, 'ชำรุด');
  assert.equal(result.records[0].appStatus, 'ดี');
  assert.equal(result.records[0].serial, 'SN1');
  assert.equal(result.records[0].cost, '26500');
  assert.equal(result.records[1].cost, '');
  assert.equal(result.records[0].sent, false);
  assert.equal(result.records[0].selected, undefined);
  assert.deepEqual(destination, []);
});

test('sends only chosen edited fields to new destination and retries do not duplicate', async () => {
  const { service, source, destination } = fixture();
  const before = structuredClone(source);
  const r = choose((await service.read()).records[0]);
  assert.equal((await service.send({ records: [r] })).added, 1);
  assert.deepEqual(destination[0], PORD_HEADERS);
  assert.equal(destination.length, 2);
  assert.equal(destination[1][0], r.asset);
  assert.equal(destination[1][2], 'Edited name');
  assert.equal(destination[1][3], 'ชำรุด');
  assert.equal(destination[1][5], '26500');
  assert.equal((await service.send({ records: [r] })).skipped, 1);
  assert.equal(destination.length, 2);
  assert.deepEqual(source, before);
  const read = (await service.read()).records[0];
  assert.equal(read.sent, true);
  assert.equal(read.asset, r.asset);
  assert.equal(read.cost, '26500');
});

test('rejects stale source, duplicate edited assets, invalid fields and mismatched headers before writing', async () => {
  const { service, source, destination } = fixture();
  const records = (await service.read()).records.filter((r) => r.appMatched).map(choose);
  await assert.rejects(service.send({ records: [] }), { status: 400 });
  await assert.rejects(
    service.send({ records: [{ ...records[0], photo: 'javascript:alert(1)' }] }),
    { status: 400 },
  );
  await assert.rejects(
    service.send({
      records: [records[0], { ...records[1], asset: records[0].asset.toLowerCase() }],
    }),
    { status: 400 },
  );
  source[2][0] = 'ชำรุด';
  await assert.rejects(service.send({ records }), { status: 409 });
  assert.equal(destination.length, 0);
  destination.push(['wrong']);
  await assert.rejects(service.read(), { status: 422 });
  await assert.rejects(service.send({ records }), { status: 422 });
});

test('stores multiple photo links in one cell and validates every line before writing', async () => {
  const { service, destination } = fixture();
  const record = choose((await service.read()).records[0]);
  const urls = [
    'https://drive.google.com/file/d/photo1/view',
    'https://drive.google.com/file/d/photo2/view',
  ];
  for (const invalid of ['javascript:alert(1)', 'https://', 'not-a-url']) {
    await assert.rejects(
      service.send({ records: [{ ...record, photo: `${urls[0]}\n${invalid}` }] }),
      { status: 400 },
    );
    assert.equal(destination.length, 0);
  }
  await service.send({ records: [{ ...record, photo: ` ${urls[0]} \r\n\n ${urls[1]} ` }] });
  assert.equal(destination[1][7], urls.join('\n'));
  assert.equal((await service.read()).records[0].photo, urls.join('\n'));
});

test('serializes concurrent retries and rejects a new source using an existing destination asset', async () => {
  const { service, destination } = fixture();
  const records = (await service.read()).records.filter((r) => r.appMatched).map(choose);
  await Promise.all([
    service.send({ records: [records[0]] }),
    service.send({ records: [records[0]] }),
  ]);
  assert.equal(destination.length, 2);
  await assert.rejects(service.send({ records: [{ ...records[1], asset: records[0].asset }] }), {
    status: 400,
  });
});

test('recovers from response loss after an append without adding rows twice', async () => {
  const { service, adapter, destination } = fixture();
  const records = [choose((await service.read()).records[0])];
  const append = adapter.appendPordDatabase;
  adapter.appendPordDatabase = async (...args) => {
    await append(...args);
    throw new Error('connection lost');
  };
  await assert.rejects(service.send({ records }), /connection lost/);
  adapter.appendPordDatabase = append;
  assert.equal((await service.send({ records })).skipped, 1);
  assert.equal(destination.length, 2);
});

test('rejects changed asset IDs without a source tracking column', async () => {
  const { service, destination } = fixture();
  const record = choose((await service.read()).records[0]);
  await assert.rejects(service.send({ records: [{ ...record, asset: 'CHANGED' }] }), {
    status: 400,
  });
  assert.deepEqual(destination, []);
});

test('keeps unmatched PDF assets and validates their revision when sending', async () => {
  const { service, destination } = fixture();
  const record = (await service.read()).records.find((r) => !r.appMatched);
  assert.ok(record);
  assert.equal(record.name, '');
  assert.equal(record.appStatus, '');
  const selected = { ...record, name: 'Manually identified item' };
  await assert.rejects(service.send({ records: [{ ...selected, revision: 'stale' }] }), {
    status: 409,
  });
  await service.send({ records: [selected] });
  assert.equal(destination[1][0], record.asset);
  assert.equal(
    (await service.read()).records.find((r) => r.sourceId === record.sourceId).sent,
    true,
  );
});

test('exposes separate PDF and Appscriptdata values without changing saved rows', async () => {
  const { service } = fixture();
  const record = (await service.read()).records[0];
  assert.equal(record.pdfStatus, 'ชำรุด');
  assert.equal(record.appFields.status, 'ดี');
  assert.equal(record.appFields.serial, 'SN1');
  assert.equal(record.pdfCost, '26500');
});
