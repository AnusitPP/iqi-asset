import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';

test('return catalog requires login and reads only the borrowed-assets sheet', async (t) => {
  let reads = 0;
  let values = [
    ['ชื่ออุปกรณ์', 'เลขครุภัณฑ์', 'S/N', 'สถานะ'],
    ['จอ', 'LOAN-001', 'SN1', 'ยืม'],
    ['แถวว่าง', '', '', ''],
    ['คอม', 'LOAN-002', '', ''],
  ];
  const adapter = new GoogleSheets({ spreadsheetId: 'fixture-sheet' });
  adapter.api = {
    spreadsheets: {
      values: {
        get: async (request) => {
          reads++;
          assert.deepEqual(request, {
            spreadsheetId: 'fixture-sheet',
            range: "'รายการยืมครุภัณฑ์'!A:T",
            valueRenderOption: 'FORMATTED_VALUE',
          });
          return { data: { values } };
        },
      },
    },
  };
  const server = createApp({ adapter }, { host: '127.0.0.1' }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/return-catalog')).status, 401);
  assert.equal(reads, 0);
  const session = await fetch(base + '/api/auth/session').then((response) => response.json());
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
    body: JSON.stringify({ password: '1234' }),
  });
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  const response = await fetch(base + '/api/return-catalog', { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    records: [
      { row: 2, asset: 'LOAN-001', serial: 'SN1', name: 'จอ' },
      { row: 4, asset: 'LOAN-002', serial: '', name: 'คอม' },
    ],
  });
  assert.equal(reads, 1);

  for (const invalid of [[], [['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'S/N', 'S/N']]]) {
    values = invalid;
    const invalidResponse = await fetch(base + '/api/return-catalog', { headers });
    assert.equal(invalidResponse.status, 422);
    assert.match((await invalidResponse.json()).error, /รายการยืมครุภัณฑ์/);
  }
  values = [['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์']];
  const emptyResponse = await fetch(base + '/api/return-catalog', { headers });
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), { records: [] });
});
