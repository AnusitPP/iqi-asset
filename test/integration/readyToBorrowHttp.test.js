import { testSession } from '../helpers/session.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOAN_HEADERS, RETURN_HEADERS } from '../helpers/lending.js';
import { createApp } from '../../backend/src/http/app.js';

test('loan search API requires login and reads only ready-to-borrow sheet', async (t) => {
  let reads = 0;
  const adapter = {
    readLoanSheets: async () => ({ loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] }),
    readReadyToBorrow: async () => {
      reads++;
      return [
        ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
        ['READY1', 'SN1', 'จอ'],
      ];
    },
    readDashboard: async () => {
      throw new Error('must not read dashboard');
    },
  };
  const authFixture = await testSession({ host: '127.0.0.1' });
  const server = createApp({ adapter }, authFixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/ready-to-borrow')).status, 401);
  assert.equal(reads, 0);
  const response = await fetch(base + '/api/ready-to-borrow', {
    headers: { Cookie: authFixture.cookie },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    records: [{ row: 2, asset: 'READY1', serial: 'SN1', name: 'จอ' }],
  });
  assert.equal(reads, 1);
});
