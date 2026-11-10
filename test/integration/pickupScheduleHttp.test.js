import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { testSession } from '../helpers/session.js';

test('admins save and clear pickup schedule and readers receive it; incomplete or invalid schedules never write', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-08T17:30:00Z') });
  const fixture = await testSession({ host: '127.0.0.1' });
  const staff = await fixture.sessions.login({
    sub: 'staff',
    name: 'Staff',
    email: 'staff@example.invalid',
  });
  const row = LOAN_HEADERS.map(() => '');
  row[0] = 'L-1';
  row[14] = 'รอดำเนินการ';
  const grids = {
    loans: [
      [...LOAN_HEADERS, 'comment', 'วันที่นัดรับ', 'เวลานัดรับ'],
      [...row, '', '', ''],
    ],
    returns: [RETURN_HEADERS],
  };
  const owner = fixture.storage.tables.Users.find((entry) => entry.google_sub === 'fixture-owner');
  fixture.storage.tables.AuditLogs.push({
    action: 'LOAN_CREATED',
    actor_user_id: owner.id,
    entity_id: 'L-1',
  });
  let writes = 0;
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    updateLoanStatus: async (_id, status, _actor, comment, pickup) => {
      writes++;
      grids.loans[1][14] = status;
      grids.loans[1][19] = comment;
      if (pickup) {
        grids.loans[1][20] = pickup.date;
        grids.loans[1][21] = pickup.time;
      }
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((res) => res.json());
  const patch = (fields, token = fixture.token) =>
    fetch(base + '/api/approval-requests/L-1', {
      method: 'PATCH',
      headers: {
        Cookie: `iqi_session=${token}`,
        'X-IQI-Request': csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'ยืม', status: 'รอดำเนินการ', adminComment: '', ...fields }),
    });
  const fields = { pickupDate: '2026-11-12', pickupTime: '09:35' };
  assert.equal((await patch(fields, staff)).status, 403);
  for (const invalid of [
    { ...fields, pickupDate: '2026-11-08' },
    { pickupDate: '2026-11-12' },
    { ...fields, pickupTime: '24:00' },
    { ...fields, pickupTime: '' },
    { ...fields, pickupDate: '2026-02-30' },
    { ...fields, kind: 'คืน' },
  ])
    assert.equal((await patch(invalid)).status, 400);
  assert.equal(writes, 0);
  assert.equal((await patch({ ...fields, pickupDate: '2026-11-09' })).status, 200);
  assert.equal((await patch(fields)).status, 200);
  for (const endpoint of ['/api/approval-requests', '/api/my-requests']) {
    const result = await fetch(base + endpoint, { headers: { Cookie: fixture.cookie } }).then(
      (res) => res.json(),
    );
    assert.equal(result.records[0].pickupDate, fields.pickupDate);
    assert.equal(result.records[0].pickupTime, fields.pickupTime);
  }
  assert.equal((await patch({ pickupDate: '', pickupTime: '' })).status, 200);
  assert.equal(grids.loans[1][20], '');
  assert.equal(grids.loans[1][21], '');
});
