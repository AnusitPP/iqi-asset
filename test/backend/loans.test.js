import test from 'node:test';
import assert from 'node:assert/strict';
import { LOAN_HEADERS, RETURN_HEADERS } from '../helpers/lending.js';
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
