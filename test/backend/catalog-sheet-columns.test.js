import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';

test('catalog deletion clears only one data row and scans every tab including formula image references', async () => {
  const adapter = Object.create(GoogleSheets.prototype);
  adapter.config = { spreadsheetId: 'fixture' };
  let clear;
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [{ properties: { title: 'พร้อมยืม' } }, { properties: { title: "Other's tab" } }],
        },
      }),
      values: {
        clear: async (request) => {
          clear = request;
        },
        batchGet: async (request) => {
          assert.deepEqual(request.ranges, ["'พร้อมยืม'", "'Other''s tab'"]);
          assert.equal(request.valueRenderOption, 'FORMULA');
          return {
            data: { valueRanges: [{ values: [['one']] }, { values: [['=IMAGE("shared")']] }] },
          };
        },
      },
    },
  };
  await adapter.clearReadyToBorrow(2);
  assert.deepEqual(clear, { spreadsheetId: 'fixture', range: "'พร้อมยืม'!2:2" });
  await assert.rejects(adapter.clearReadyToBorrow(1), { status: 400 });
  assert.deepEqual(await adapter.readPhotoReferences(), ['one', '=IMAGE("shared")']);
  adapter.api.spreadsheets.values.batchGet = async () => ({ data: { valueRanges: [{}] } });
  await assert.rejects(adapter.readPhotoReferences(), /ไม่ครบ/);
});

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
