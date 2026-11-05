import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { testSession } from '../helpers/session.js';

test('return catalog requires Google session and lists only own approved loans without pending returns', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const row = (id, status) => {
    const row = Array(19).fill('');
    Object.assign(row, { 0: id, 1: id, 7: id, 8: 'SN1', 9: 'Mouse', 14: status });
    return row;
  };
  const grids = {
    loans: [
      LOAN_HEADERS,
      row('OWN', 'กำลังยืม'),
      row('OTHER', 'กำลังยืม'),
      row('PENDING', 'รอดำเนินการ'),
    ],
    returns: [RETURN_HEADERS],
  };
  const user = fixture.storage.tables.Users[0];
  fixture.storage.tables.AuditLogs.push(
    ...['OWN', 'PENDING'].map((id) => ({
      actor_user_id: user.id,
      action: 'LOAN_CREATED',
      entity_id: id,
    })),
  );
  let reads = 0;
  const adapter = {
    readLoanSheets: async () => {
      reads++;
      return structuredClone(grids);
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/return-catalog`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal(reads, 0);
  const response = await fetch(url, { headers: { Cookie: fixture.cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    records: [{ row: 2, asset: 'OWN', serial: 'SN1', name: 'Mouse', team: '' }],
  });
  const pendingReturn = Array(19).fill('');
  pendingReturn[0] = 'R1';
  pendingReturn[2] = 'OWN';
  pendingReturn[14] = 'รอดำเนินการ';
  grids.returns.push(pendingReturn);
  assert.deepEqual(
    await fetch(url, { headers: { Cookie: fixture.cookie } }).then((res) => res.json()),
    { records: [] },
  );
});
