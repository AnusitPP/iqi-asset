import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
import { LOAN_HEADERS, normalizeLoanGrid } from '../../backend/src/core/lending/schema.js';

test('pickup fields expand a full grid and write dedicated RAW cells without changing notes or email', async () => {
  const headers = [...LOAN_HEADERS, 'email', 'comment'];
  const row = headers.map(() => '');
  row[0] = 'L-1';
  row[13] = 'original notes';
  row[19] = 'borrower@example.invalid';
  const adapter = Object.create(GoogleSheets.prototype);
  adapter.config = { spreadsheetId: 'fixture' };
  adapter.readLoanSheets = async () => ({ loans: [headers, row] });
  const calls = [];
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            {
              properties: {
                title: 'รายการยืมครุภัณฑ์',
                sheetId: 7,
                gridProperties: { columnCount: 21 },
              },
            },
          ],
        },
      }),
      batchUpdate: async (request) => {
        calls.push(request.requestBody);
      },
      values: {
        batchUpdate: async (request) => {
          calls.push(request.requestBody);
        },
      },
    },
  };
  await adapter.updateLoanStatus('L-1', 'รอดำเนินการ', 'Admin', 'comment', {
    date: '2026-11-12',
    time: '09:35',
  });
  assert.deepEqual(calls[0].requests, [
    { appendDimension: { sheetId: 7, dimension: 'COLUMNS', length: 2 } },
  ]);
  assert.equal(calls[1].valueInputOption, 'RAW');
  assert.ok(
    calls[1].data.some(
      (entry) => entry.range.endsWith('V1') && entry.values[0][0] === 'วันที่นัดรับ',
    ),
  );
  assert.ok(
    calls[1].data.some((entry) => entry.range.endsWith('W2') && entry.values[0][0] === '09:35'),
  );
  assert.ok(!calls[1].data.some((entry) => /!(N|T)2$/.test(entry.range)));
});
test('pickup normalization preserves canonical offsets even without a comment column', () => {
  const row = LOAN_HEADERS.map(() => '');
  const normalized = normalizeLoanGrid([
    [...LOAN_HEADERS, 'เวลานัดรับ', 'วันที่นัดรับ'],
    [...row, '09:35', '2026-11-12'],
  ]);
  assert.deepEqual(normalized[1].slice(19), ['', '2026-11-12', '09:35']);
});
