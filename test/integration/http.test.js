import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { Records } from '../../backend/src/features/records/service.js';
import { parseSheet } from '../../backend/src/features/records/search.js';
test('HTTP API protects secrets, rejects writes outside IQI, and reports failures', async () => {
  const config = { sheets: ['IQI', 'รายการทั้งหมด', 'all'], host: '0.0.0.0' };
  let writeCount = 0,
    failWrite = false;
  const adapter = {
    initialize: async () => {},
    read: async (names = config.sheets) =>
      names.map((n) =>
        parseSheet(n, [
          ['เลขครุภัณฑ์', 'หมายเหตุ'],
          ['207-007', 'original'],
        ]),
      ),
    writeIQI: async () => {
      writeCount++;
      if (failWrite) throw new Error('network unavailable');
    },
  };
  const app = createApp(new Records(adapter, config), config);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const fetch = (url, options = {}) =>
    globalThis.fetch(url, { ...options, headers: { Cookie: cookie, ...options.headers } });
  try {
    const auth = await fetch(base + '/api/auth/session').then((r) => r.json());
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-IQI-Request': auth.csrf },
      body: JSON.stringify({ password: '1234' }),
    });
    cookie = login.headers.get('set-cookie').split(';')[0];
    const status = await fetch(base + '/api/status').then((r) => r.json());
    const record = await fetch(base + '/api/record?sheet=IQI&row=2').then((r) => r.json());
    const put = (body, headers = {}) =>
      fetch(base + '/api/iqi/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-IQI-Request': status.csrf, ...headers },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await put({ sheet: 'all', values: record.values, revision: record.revision })).status,
      403,
    );
    assert.equal(
      (await put({ values: record.values, revision: record.revision }, { 'X-IQI-Request': 'bad' }))
        .status,
      403,
    );
    assert.equal(
      (
        await put(
          { values: record.values, revision: record.revision },
          { Origin: 'https://other.example' },
        )
      ).status,
      403,
    );
    assert.equal(writeCount, 0);
    for (const path of [
      '/credentials/service-account.json',
      '/.env',
      '/package.json',
      '/src/config.js',
      '/backend/src/config/config.js',
    ])
      assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base + '/api/record?sheet=all&row=0')).status, 400);
    assert.equal((await fetch(base + '/api/search?q=')).status, 400);
    failWrite = true;
    const response = await put({ values: ['207-007', 'new note'], revision: record.revision });
    assert.equal(response.status, 500);
    assert.ok((await response.json()).error);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
