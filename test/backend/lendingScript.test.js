import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { buildSharedScript } from '../../backend/scripts/build-lending-script.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { createLendingGateway } from '../../backend/src/integrations/google/lendingGateway.js';
import { LoanRequestService } from '../../backend/src/features/loans/service.js';
import { ReturnRequestService } from '../../backend/src/features/returns/service.js';

const secret = 'test-secret-'.repeat(4);
const url = 'https://script.google.com/macros/s/test-deployment/exec';
const source =
  (await buildSharedScript()) +
  '\n' +
  (await readFile(new URL('../../apps-script/lending/Code.gs', import.meta.url), 'utf8'));
function fixture() {
  const grids = [
    [[...LOAN_HEADERS, 'email']],
    [RETURN_HEADERS],
    [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A-1', 'SN-1', 'Laptop'],
    ],
  ];
  let held = false,
    available = true,
    failWrite = false,
    calls = 0;
  const sheets = grids.map((grid, index) => ({
    getSheetId: () => index,
    getDataRange: () => ({ getDisplayValues: () => structuredClone(grid) }),
  }));
  const names = ['รายการยืมครุภัณฑ์', 'รายการคืนครุภัณฑ์', 'พร้อมยืม'];
  const context = vm.createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) => (name === 'LENDING_SCRIPT_SECRET' ? secret : 'sheet-id'),
      }),
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeHmacSha256Signature: (value, key) => [
        ...createHmac('sha256', key).update(value).digest(),
      ],
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()],
      getUuid: randomUUID,
      formatDate: (_, __, pattern) =>
        pattern === 'yyyy-MM-dd' ? '2026-11-05' : '05/11/2026 12:00:00',
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          if (!available || held) return false;
          held = true;
          return true;
        },
        hasLock: () => held,
        releaseLock: () => {
          held = false;
        },
      }),
    },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (name) => sheets[names.indexOf(name)] }) },
    Sheets: {
      Spreadsheets: {
        batchUpdate: ({ requests }) => {
          assert.equal(held, true, 'every write must hold the script lock');
          calls++;
          if (failWrite) throw new Error('Google failed');
          const copy = structuredClone(grids);
          for (const request of requests) {
            if (request.appendCells) {
              const { sheetId, rows } = request.appendCells;
              for (const row of rows)
                copy[sheetId].push(row.values.map((cell) => cell.userEnteredValue.stringValue));
            } else {
              const { start, rows } = request.updateCells;
              copy[start.sheetId][start.rowIndex][start.columnIndex] =
                rows[0].values[0].userEnteredValue.stringValue;
            }
          }
          grids.forEach((grid, i) => grid.splice(0, grid.length, ...copy[i]));
        },
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
  });
  vm.runInContext(source, context);
  const execute = (action, body, options = {}) => {
    const payload = JSON.stringify({ version: 1, timestamp: Date.now(), action, body, ...options });
    return context.doPost({
      postData: {
        contents: JSON.stringify({
          payload,
          signature: createHmac('sha256', secret).update(payload).digest('hex'),
        }),
      },
    });
  };
  return {
    grids,
    execute,
    context,
    locked: () => held,
    calls: () => calls,
    setAvailable: (value) => {
      available = value;
    },
    failWrites: (value) => {
      failWrite = value;
    },
  };
}
const loan = () => ({
  requestId: randomUUID(),
  borrower: 'Test',
  team: 'IQI',
  notes: '',
  selectedAsset: { asset: 'A-1', serial: 'SN-1' },
  purpose: 'Test',
  start: '2026-11-05',
  due: '2026-11-12',
  email: 'test@example.com',
});

test('script rejects unsigned, expired and unavailable-lock commands without writes', () => {
  const f = fixture();
  assert.equal(f.context.doPost({ postData: { contents: '{}' } }).status, 401);
  assert.equal(f.execute('loan', loan(), { timestamp: 0 }).status, 401);
  f.setAvailable(false);
  assert.equal(f.execute('loan', loan()).status, 503);
  assert.equal(f.calls(), 0);
});
test('loan retry is idempotent; changed payload and second borrower cannot reserve the same item', () => {
  const f = fixture(),
    body = loan();
  const first = f.execute('loan', body);
  assert.equal(first.ok, true);
  assert.equal(f.execute('loan', body).result.unchanged, true);
  assert.equal(f.execute('loan', { ...body, purpose: 'Changed' }).status, 409);
  assert.equal(f.execute('loan', loan()).status, 409);
  assert.equal(f.grids[0].length, 2);
  assert.equal(f.grids[0][1][19], body.email);
  assert.equal(f.locked(), false);
});
test('return requires ownership, atomically updates loan, and completed/damaged item cannot be borrowed', () => {
  const f = fixture();
  const id = f.execute('loan', loan()).result.id;
  assert.equal(
    f.execute('approve', {
      id,
      kind: 'ยืม',
      status: 'กำลังยืม',
      expectedStatus: 'รอดำเนินการ',
      responsible: 'Admin',
    }).ok,
    true,
  );
  const body = { ...loan(), date: '2026-11-05', ownLoanIds: [] };
  assert.equal(f.execute('return', body).status, 409);
  body.ownLoanIds = [id];
  const returned = f.execute('return', body);
  assert.equal(returned.ok, true);
  assert.equal(f.grids[0][1][14], 'รอดำเนินการคืน');
  assert.equal(f.execute('return', body).result.unchanged, true);
  assert.equal(
    f.execute('approve', {
      id,
      kind: 'ยืม',
      status: 'ยกเลิก',
      expectedStatus: 'รอดำเนินการคืน',
      responsible: 'Admin',
    }).status,
    409,
  );
  const approval = {
    id: returned.result.id,
    kind: 'คืน',
    status: 'เสร็จสิ้น',
    expectedStatus: 'รอดำเนินการ',
    responsible: 'Admin',
  };
  assert.equal(f.execute('approve', approval).status, 400);
  approval.condition = 'ชำรุด';
  assert.equal(f.execute('approve', approval).ok, true);
  assert.equal(f.grids[0][1][14], 'เสร็จสิ้น');
  assert.equal(f.execute('approve', approval).result.unchanged, true);
  assert.equal(f.execute('loan', loan()).status, 409);
});
test('stale approval and invalid dates are rejected; Google failure releases lock and preserves retry', () => {
  const f = fixture(),
    body = loan();
  assert.equal(f.execute('loan', { ...body, start: '2026-11-04' }).status, 400);
  assert.equal(f.execute('loan', { ...body, due: '2026-11-13' }).status, 400);
  f.failWrites(true);
  assert.equal(f.execute('loan', body).status, 502);
  assert.equal(f.locked(), false);
  assert.equal(f.grids[0].length, 1);
  f.failWrites(false);
  const id = f.execute('loan', body).result.id;
  assert.equal(
    f.execute('approve', {
      id,
      kind: 'ยืม',
      status: 'กำลังยืม',
      expectedStatus: 'กำลังดำเนินการ',
      responsible: 'Admin',
    }).status,
    409,
  );
});
test('gateway signs commands and surfaces Apps Script errors without retrying writes', async () => {
  let calls = 0;
  const gateway = createLendingGateway(
    { lendingScriptUrl: url, lendingScriptSecret: secret },
    async (_, options) => {
      calls++;
      const envelope = JSON.parse(options.body);
      assert.equal(
        envelope.signature,
        createHmac('sha256', secret).update(envelope.payload).digest('hex'),
      );
      assert.equal(JSON.parse(envelope.payload).action, 'loan');
      return {
        ok: true,
        json: async () => ({ ok: false, status: 409, error: 'อุปกรณ์นี้มีรายการยืมค้างอยู่' }),
      };
    },
  );
  await assert.rejects(() => gateway.execute('loan', loan()), { status: 409 });
  assert.equal(calls, 1);
  assert.equal(createLendingGateway({}), null);
  assert.throws(() =>
    createLendingGateway({ lendingScriptUrl: 'https://evil.example', lendingScriptSecret: secret }),
  );
});

test('configured services delegate writes and never enter the local/hosted queue', async () => {
  const calls = [];
  const ledger = {
    gateway: {
      execute: async (action, body) => {
        calls.push({ action, body });
        return { id: action };
      },
    },
    withWriteLock: () => assert.fail('must not write directly when gateway is configured'),
  };
  const body = loan();
  assert.equal((await new LoanRequestService(ledger).submit(body)).id, 'loan');
  assert.equal((await new ReturnRequestService(ledger).submit(body)).id, 'return');
  assert.deepEqual(
    calls.map((entry) => entry.action),
    ['loan', 'return'],
  );
});

test('checked-in Apps Script schemas match backend sources', async () => {
  assert.equal(
    await readFile(new URL('../../apps-script/lending/Shared.gs', import.meta.url), 'utf8'),
    await buildSharedScript(),
  );
});

test('good return releases equipment and stale approval cannot reactivate the old loan', () => {
  const f = fixture();
  const id = f.execute('loan', loan()).result.id;
  f.execute('approve', {
    id,
    kind: 'ยืม',
    expectedStatus: 'รอดำเนินการ',
    status: 'กำลังยืม',
    responsible: 'Admin',
  });
  const result = f.execute('return', { ...loan(), ownLoanIds: [id], date: '2026-11-05' });
  f.execute('approve', {
    id: result.result.id,
    kind: 'คืน',
    expectedStatus: 'รอดำเนินการ',
    status: 'เสร็จสิ้น',
    condition: 'ดี',
    responsible: 'Admin',
  });
  assert.equal(f.execute('loan', loan()).ok, true);
  assert.equal(
    f.execute('approve', {
      id,
      kind: 'ยืม',
      expectedStatus: 'เสร็จสิ้น',
      status: 'กำลังยืม',
      responsible: 'Admin',
    }).status,
    409,
  );
});
