import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
import { LENDING_SHEETS } from '../../backend/src/core/lending/schema.js';
import { loadConfig } from '../../backend/src/core/config/loadConfig.js';

test('configuration ignores retired inspection sheet overrides', () => {
  const config = loadConfig({
    SHEET_IQI: 'removed',
    SHEET_ALL_ITEMS: 'removed',
    SHEET_ALL: 'removed',
  });
  assert.deepEqual(config.sheets, LENDING_SHEETS);
});
test('startup accepts only lending tabs, performs no writes, and reports missing active tabs', async () => {
  let titles = [...LENDING_SHEETS];
  const adapter = new GoogleSheets({ keyFile: 'unused', spreadsheetId: 'test' });
  adapter.api = {
    spreadsheets: {
      get: async () => ({ data: { sheets: titles.map((title) => ({ properties: { title } })) } }),
    },
  };
  await adapter.initialize();
  assert.equal(adapter.ensureReviewSheet, undefined);
  assert.equal(adapter.writeIQI, undefined);
  titles = titles.slice(1);
  await assert.rejects(adapter.initialize(), { status: 422, message: 'ไม่พบ Sheet: พร้อมยืม' });
});
