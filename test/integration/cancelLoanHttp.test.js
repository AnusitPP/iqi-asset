import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { testSession } from '../helpers/session.js';

test('borrowers cancel only their own pending loans, with CSRF, audit and released availability', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const staff = await fixture.sessions.login({
    sub: 'borrower',
    name: 'Borrower',
    email: 'borrower@example.invalid',
  });
  const other = await fixture.sessions.login({
    sub: 'other',
    name: 'Other',
    email: 'other@example.invalid',
  });
  const borrower = fixture.storage.tables.Users.find((entry) => entry.google_sub === 'borrower');
  const row = LOAN_HEADERS.map(() => '');
  Object.assign(row, {
    0: 'L-1',
    1: 'item-1',
    3: 'Borrower',
    4: 'IQI',
    6: 'Computer',
    7: 'A1',
    8: 'S1',
    9: 'Laptop',
    14: 'รอดำเนินการ',
  });
  const grids = {
    loans: [
      [...LOAN_HEADERS, 'email'],
      [...row, ''],
    ],
    returns: [RETURN_HEADERS],
  };
  fixture.storage.tables.AuditLogs.push({
    actor_user_id: borrower.id,
    action: 'LOAN_CREATED',
    entity_id: 'L-1',
  });
  let writes = 0;
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A1', 'S1', 'Laptop'],
    ],
    updateLoanStatus: async (id, status, actor) => {
      writes++;
      assert.equal(id, 'L-1');
      assert.equal(actor, 'Borrower');
      grids.loans[1][14] = status;
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((res) => res.json());
  const post = (token, csrfToken = csrf, id = 'L-1') =>
    fetch(`${base}/api/my-requests/${id}/cancel`, {
      method: 'POST',
      headers: {
        Cookie: `iqi_session=${token}`,
        'X-IQI-Request': csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ borrower: 'Borrower', status: 'กำลังยืม' }),
    });
  assert.equal((await post(staff, 'wrong')).status, 403);
  assert.equal((await post('invalid')).status, 401);
  assert.equal((await post(other)).status, 403);
  // Even an admin must own a request when using the self-cancellation endpoint.
  assert.equal((await post(fixture.token)).status, 403);
  for (const status of ['กำลังยืม', 'เสร็จสิ้น', 'ไม่อนุมัติ', 'ยกเลิก', 'รอดำเนินการคืน']) {
    grids.loans[1][14] = status;
    assert.equal((await post(staff)).status, 409);
  }
  grids.loans[1][14] = 'รอดำเนินการ';
  grids.returns.push(['R-1', 'L-1', 'item-1']);
  assert.equal((await post(staff)).status, 409);
  grids.returns.pop();
  assert.equal((await post(staff, csrf, 'R-1')).status, 409);
  assert.equal(writes, 0);
  assert.equal((await post(staff)).status, 200);
  assert.equal(grids.loans[1][14], 'ยกเลิก');
  assert.equal(writes, 1);
  const audit = fixture.storage.tables.AuditLogs.find((entry) => entry.action === 'LOAN_CANCELLED');
  assert.equal(audit.actor_user_id, borrower.id);
  assert.equal(audit.entity_id, 'L-1');
  assert.equal((await post(staff)).status, 409);
  assert.equal(writes, 1);
  const available = await fetch(base + '/api/ready-to-borrow', {
    headers: { Cookie: `iqi_session=${staff}` },
  }).then((res) => res.json());
  assert.equal(available.records[0].asset, 'A1');
  // Loans created on behalf of a borrower can be owned through the saved email.
  fixture.storage.tables.AuditLogs = [];
  grids.loans[1][14] = 'รอดำเนินการ';
  grids.loans[1][LOAN_HEADERS.length] = 'borrower@example.invalid';
  assert.equal((await post(staff)).status, 200);
});
