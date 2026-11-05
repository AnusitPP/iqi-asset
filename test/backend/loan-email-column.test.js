import { LENDING_STATUS } from '../../shared/features/lending/status.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAN_HEADERS,
  RETURN_HEADERS,
  normalizeLoanGrid,
} from '../../backend/src/core/lending/schema.js';
import { LendingLedger } from '../../backend/src/core/lending/ledger.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
import {
  parseLoanEmails,
  buildDueReminders,
} from '../../backend/src/features/mail/due-reminders.js';

const headers = [...LOAN_HEADERS.slice(0, 4), 'email', ...LOAN_HEADERS.slice(4)];
const canonical = Array(19).fill('');
Object.assign(canonical, {
  0: 'L-1',
  1: 'ITEM-1',
  3: 'Alice',
  4: 'IQI',
  7: 'ASSET-1',
  9: 'Laptop',
  12: '2026-11-06',
  14: 'รอดำเนินการ',
  17: 'REQUEST-1',
});
const physical = [...canonical.slice(0, 4), 'alice@example.com', ...canonical.slice(4)];

test('email next to borrower preserves loan fields and personal reminder recipient', async () => {
  const values = [headers, physical];
  const adapter = { readLoanSheets: async () => ({ loans: values, returns: [RETURN_HEADERS] }) };
  const ledger = await new LendingLedger(adapter).readLedger();
  assert.deepEqual(ledger.loans[0], canonical);
  assert.deepEqual(normalizeLoanGrid([LOAN_HEADERS, canonical]), [LOAN_HEADERS, canonical]);
  const plan = buildDueReminders(ledger, parseLoanEmails(values), new Date('2026-11-05T01:00:00Z'));
  assert.equal(plan.messages[0].email, 'alice@example.com');
  assert.match(plan.messages[0].text, /ASSET-1/);
  const returned = Array(19).fill('');
  returned[2] = 'ITEM-1';
  returned[14] = LENDING_STATUS.RETURN_RECEIVED;
  returned[0] = 'R-1';
  adapter.readLoanSheets = async () => ({ loans: values, returns: [RETURN_HEADERS, returned] });
  assert.equal(
    buildDueReminders(await new LendingLedger(adapter).readLedger(), parseLoanEmails(values))
      .messages.length,
    0,
  );
});

test('append loan writes email and shifted fields correctly; return updates actual status column', async () => {
  const adapter = Object.create(GoogleSheets.prototype);
  adapter.config = { spreadsheetId: 'fixture' };
  adapter.readLoanSheets = async () => ({ loans: [headers, physical], returns: [RETURN_HEADERS] });
  let sent;
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            { properties: { title: 'รายการยืมครุภัณฑ์', sheetId: 1 } },
            { properties: { title: 'รายการคืนครุภัณฑ์', sheetId: 2 } },
          ],
        },
      }),
      batchUpdate: async (request) => {
        sent = request.requestBody.requests;
      },
    },
  };
  await adapter.appendLoanRows('loans', [canonical], { email: 'alice@example.com' });
  assert.deepEqual(
    sent[0].appendCells.rows[0].values.map((cell) => cell.userEnteredValue.stringValue),
    physical,
  );
  const returned = Array(19).fill('');
  returned[2] = 'ITEM-1';
  returned[14] = LENDING_STATUS.RETURN_RECEIVED;
  await adapter.appendLoanRows('returns', [returned]);
  assert.equal(sent[0].updateCells.start.columnIndex, 15);
  assert.equal(sent[0].updateCells.start.rowIndex, 1);
  assert.equal(sent[1].appendCells.sheetId, 2);
});

test('ambiguous or missing loan columns fail before interpreting shifted data', () => {
  assert.throws(
    () => normalizeLoanGrid([headers.map((name) => (name === 'ทีม' ? 'email' : name))]),
    { status: 422 },
  );
  assert.throws(() => normalizeLoanGrid([headers.filter((name) => name !== 'กำหนดวันส่งคืน')]), {
    status: 422,
  });
});

test('approval and completed returns update shifted status fields without overwriting email or notes', async () => {
  const adapter = Object.create(GoogleSheets.prototype);
  adapter.config = { spreadsheetId: 'fixture' };
  const returned = Array(19).fill('');
  Object.assign(returned, { 0: 'R-1', 1: 'L-1', 2: 'ITEM-1', 13: 'ดี' });
  adapter.readLoanSheets = async () => ({
    loans: [headers, physical],
    returns: [RETURN_HEADERS, returned],
  });
  const writes = [];
  adapter.api = {
    spreadsheets: { values: { batchUpdate: async (request) => writes.push(request.requestBody) } },
  };
  await adapter.updateLoanStatus('L-1', 'กำลังยืม', 'Admin');
  assert.deepEqual(writes[0].data, [
    { range: "'รายการยืมครุภัณฑ์'!P2", values: [['กำลังยืม']] },
    { range: "'รายการยืมครุภัณฑ์'!Q2", values: [['Admin']] },
  ]);
  await adapter.updateReturnStatus('R-1', LENDING_STATUS.RETURN_RECEIVED, 'Admin', 'ดี');
  assert.deepEqual(writes[1].data, [
    {
      range: "'รายการคืนครุภัณฑ์'!N2:P2",
      values: [['ดี', LENDING_STATUS.RETURN_RECEIVED, 'Admin']],
    },
    { range: "'รายการยืมครุภัณฑ์'!P2", values: [[LENDING_STATUS.RETURNED]] },
  ]);
});
