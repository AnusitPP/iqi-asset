import test from 'node:test';
import assert from 'node:assert/strict';
import { testSession } from '../helpers/session.js';
import { pdfReference } from '../../backend/src/features/porddatabase/pdf-reference.js';
import { createApp } from '../../backend/src/http/app.js';

test('PORDDATABASE requires admin for reads and writes and rejects unsigned writes', async (t) => {
  let reads = 0;
  const adapter = {
    readDashboard: async () => {
      reads++;
      return [['ผลตรวจ Apps Script', 'สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script']];
    },
    readPordDatabase: async () => [],
  };
  const fixture = await testSession({ host: '127.0.0.1' });
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/api/porddatabase`)).status, 401);
  assert.equal(reads, 0);
  const response = await fetch(`${url}/api/porddatabase`, { headers: { Cookie: fixture.cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sheet, 'PORDDATABASE');
  assert.equal(body.records.length, Object.keys(pdfReference).length);
  assert.ok(body.records.every((r) => !r.appMatched && !r.sent));
  assert.equal(
    (
      await fetch(`${url}/api/porddatabase`, {
        method: 'POST',
        headers: { Cookie: fixture.cookie, 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  );
  const tables = await fixture.storage.read();
  await fixture.storage.write([
    { table: 'Admins', row: tables.Admins[0].row, values: { status: 'DISABLED' } },
  ]);
  assert.equal(
    (await fetch(`${url}/api/porddatabase`, { headers: { Cookie: fixture.cookie } })).status,
    403,
  );
});
