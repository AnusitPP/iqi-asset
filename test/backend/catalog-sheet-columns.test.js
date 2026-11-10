import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';

for (const columnCount of [5, 26]) {
  test(`category header safely fits a sheet with ${columnCount} physical columns`, async () => {
    const adapter = Object.create(GoogleSheets.prototype);
    adapter.config = { spreadsheetId: 'fixture' };
    const batches = [];
    adapter.api = {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [
              { properties: { title: 'พร้อมยืม', sheetId: 7, gridProperties: { columnCount } } },
            ],
          },
        }),
        batchUpdate: async (request) => {
          batches.push(request);
        },
        values: {
          update: async () => {
            assert.fail('header must be written atomically with grid expansion');
          },
        },
      },
    };
    await adapter.addReadyToBorrowCategory(5);
    assert.equal(batches.length, 1);
    const requests = batches[0].requestBody.requests;
    assert.equal(requests.length, columnCount === 5 ? 2 : 1);
    if (columnCount === 5)
      assert.deepEqual(requests[0], {
        appendDimension: { sheetId: 7, dimension: 'COLUMNS', length: 1 },
      });
    assert.deepEqual(requests.at(-1), {
      updateCells: {
        range: {
          sheetId: 7,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 5,
          endColumnIndex: 6,
        },
        rows: [{ values: [{ userEnteredValue: { stringValue: 'หมวดหมู่' } }] }],
        fields: 'userEnteredValue',
      },
    });
  });
}
