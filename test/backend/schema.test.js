import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
import { parseSheet } from '../../backend/src/features/records/search.js';
test('adds exactly one IQI status header after occupied columns, never touches other sheets, and is idempotent', async () => {
  const rows = [
    ['เลขครุภัณฑ์', 'รายการ', ''],
    ['001', 'A', '=IF(TRUE,"","")'],
  ];
  const requests = [];
  const adapter = new GoogleSheets({
    sheets: ['IQI', 'รายการทั้งหมด', 'all'],
    spreadsheetId: 'test',
    keyFile: 'unused',
  });
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            {
              properties: {
                title: 'IQI',
                sheetId: 9,
                gridProperties: { columnCount: 3, rowCount: 100 },
              },
            },
          ],
        },
      }),
      values: { get: async () => ({ data: { values: rows } }) },
      batchUpdate: async ({ requestBody }) => {
        requests.push(...requestBody.requests);
        const update = requestBody.requests.find((r) => r.updateCells)?.updateCells;
        rows[update.start.rowIndex][update.start.columnIndex] =
          update.rows[0].values[0].userEnteredValue.stringValue;
      },
    },
  };
  adapter.read = async () => [parseSheet('IQI', rows)];
  assert.equal(await adapter.ensureSearchStatusColumn(), true);
  assert.deepEqual(requests[0], {
    appendDimension: { sheetId: 9, dimension: 'COLUMNS', length: 1 },
  });
  assert.equal(requests[1].updateCells.start.columnIndex, 3);
  assert.equal(rows[0][3], 'สถานะการค้นหา');
  assert.equal(rows[1][2], '=IF(TRUE,"","")');
  assert.ok(
    requests.every(
      (r) =>
        Object.values(r)[0].sheetId === 9 ||
        Object.values(r)[0].start?.sheetId === 9 ||
        Object.values(r)[0].range?.sheetId === 9,
    ),
  );
  assert.equal(await adapter.ensureSearchStatusColumn(), false);
  assert.equal(requests.length, 3);
});
