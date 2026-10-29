import test from 'node:test';
import assert from 'node:assert/strict';
import { Loans, LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/services/loans.js';
const fixture = () => {
  const grids = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A', 'SN', 'จอ Monitor'],
      ['B', '', 'Keyboard'],
    ],
    appendLoanRows: async (kind, rows) => grids[kind].push(...rows),
  };
  return { service: new Loans(adapter), grids };
};
const body = (id = 'request-0001') => ({
  requestId: id,
  borrower: 'ทดสอบ',
  team: 'IQI',
  purpose: 'ประชุม',
  start: '2026-10-29',
  due: '2026-10-30',
  notes: '',
  items: [
    { asset: 'A', serial: 'SN' },
    { asset: 'B', serial: '' },
  ],
});
test('loans are atomic groups, idempotent, exclude active assets, support partial and damaged returns', async () => {
  const { service } = fixture();
  const result = await service.borrow(body());
  assert.equal(result.items.length, 2);
  assert.equal((await service.borrow(body())).id, result.id);
  assert.equal((await service.available()).records.length, 0);
  await assert.rejects(() => service.borrow(body('request-0002')), { status: 409 });
  await service.returnItems({
    requestId: 'return-00001',
    itemIds: [result.items[0].itemId],
    borrower: 'ผู้คืน',
    date: '2026-10-30',
    condition: 'ชำรุด',
    notes: 'จอเสีย',
    staff: 'เจ้าหน้าที่',
  });
  assert.equal((await service.outstanding()).records.length, 1);
  assert.equal((await service.available()).records.length, 0);
  await service.returnItems({
    requestId: 'return-00002',
    itemIds: [result.items[1].itemId],
    borrower: 'ผู้คืน',
    date: '2026-10-30',
    condition: 'ดี',
    notes: '',
    staff: 'เจ้าหน้าที่',
  });
  assert.equal((await service.outstanding()).records.length, 0);
  assert.equal((await service.available()).records[0].asset, 'B');
});
test('dates, unknown items and repeated return are validated', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.borrow({ ...body(), due: '2026-11-10' }), { status: 400 });
  await assert.rejects(() => service.borrow({ ...body(), items: [{ asset: 'X', serial: '' }] }), {
    status: 409,
  });
  const r = await service.borrow(body());
  const back = {
    requestId: 'return-00003',
    itemIds: [r.items[0].itemId],
    borrower: 'ผู้คืน',
    date: '2026-10-29',
    condition: 'ดี',
    notes: '',
    staff: 'เจ้าหน้าที่',
  };
  await service.returnItems(back);
  await service.returnItems(back);
  await assert.rejects(() => service.returnItems({ ...back, requestId: 'return-00004' }), {
    status: 409,
  });
});

test('concurrent requests serialize; conflicting retry and hosted writes are rejected', async () => {
  const { service } = fixture();
  const results = await Promise.allSettled([
    service.borrow(body()),
    service.borrow(body('request-other')),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409);
  await assert.rejects(() => service.borrow({ ...body(), purpose: 'เปลี่ยนข้อมูล' }), {
    status: 409,
  });
  const hosted = new Loans({}, { hosted: true });
  assert.throws(() => hosted.borrow(body()), { status: 503 });
  await assert.rejects(() => service.borrow({ ...body('request-invalid'), items: [null] }), {
    status: 400,
  });
});

test('return writes and loan status update share one Sheets batch', async () => {
  const { GoogleSheets } = await import('../../backend/src/integrations/google/googleSheets.js');
  const a = Object.create(GoogleSheets.prototype);
  a.config = { spreadsheetId: 'test' };
  let sent;
  a.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            { properties: { title: 'รายการยืมครุภัณฑ์', sheetId: 1 } },
            { properties: { title: 'รายการคืนครุภัณฑ์', sheetId: 2 } },
          ],
        },
      }),
      batchUpdate: async (b) => {
        sent = b;
      },
    },
  };
  a.readLoanSheets = async () => ({
    loans: [LOAN_HEADERS, ['loan', 'item']],
    returns: [RETURN_HEADERS],
  });
  const returned = Array(19).fill('');
  returned[0] = 'return';
  returned[1] = 'loan';
  returned[2] = 'item';
  returned[14] = 'รับคืนแล้ว';
  await a.appendLoanRows('returns', [returned]);
  assert.equal(sent.requestBody.requests.length, 2);
  assert.equal(
    sent.requestBody.requests[0].updateCells.rows[0].values[0].userEnteredValue.stringValue,
    'คืนแล้ว',
  );
  assert.equal(sent.requestBody.requests[1].appendCells.sheetId, 2);
});
