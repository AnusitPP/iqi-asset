import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { testSession } from '../helpers/session.js';

test('only admins may serve another borrower; chosen identity reaches Sheets, audit and confirmation email', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-09T01:00:00Z') });
  const fixture = await testSession({ host: '127.0.0.1' });
  const staffToken = await fixture.sessions.login({
    sub: 'staff',
    name: 'Staff',
    email: 'staff@example.invalid',
  });
  const adminToken = await fixture.sessions.login({
    sub: 'admin',
    name: 'Admin',
    email: 'admin@example.invalid',
  });
  const admin = fixture.storage.tables.Users.find((user) => user.google_sub === 'admin');
  await fixture.storage.write([
    {
      table: 'Admins',
      values: {
        id: 'grant',
        user_id: admin.id,
        email: admin.email,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    },
  ]);
  const grids = { loans: [[...LOAN_HEADERS, 'email']], returns: [RETURN_HEADERS] };
  const recipients = [],
    emails = [];
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A1', 'SN1', 'Mouse'],
      ['A2', 'SN2', 'Mouse'],
      ['A3', 'SN3', 'Mouse'],
    ],
    appendLoanRows: async (kind, rows, options) => {
      grids[kind].push(...rows.map((row) => [...row, options.email]));
      emails.push(options.email);
    },
  };
  fixture.config.confirmLoan = async (_ledger, _result, email) => {
    recipients.push(email);
    return 'sent';
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/session').then((response) => response.json());
  const body = {
    serviceMode: true,
    borrower: 'Service Borrower',
    email: 'borrower@example.invalid',
    requestId: 'service-001',
    team: 'IQI',
    category: 'เมาส์ (Mouse)',
    identifier: 'A1',
    selectedAsset: { asset: 'A1', serial: 'SN1' },
    purpose: 'Meeting',
    start: '2026-11-09',
    due: '2026-11-10',
    notes: '',
  };
  const post = (token, data) =>
    fetch(base + '/api/loans', {
      method: 'POST',
      headers: {
        Cookie: `iqi_session=${token}`,
        'X-IQI-Request': csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  assert.equal((await post(staffToken, body)).status, 403);
  assert.equal((await post(adminToken, { ...body, serviceMode: 'true' })).status, 400);
  assert.equal((await post(adminToken, { ...body, email: '' })).status, 400);
  assert.equal((await post(adminToken, { ...body, email: 'bad' })).status, 400);
  assert.equal(grids.loans.length, 1);
  assert.equal((await post(adminToken, body)).status, 200);
  assert.equal(grids.loans[1][3], 'Service Borrower');
  assert.deepEqual(emails, ['borrower@example.invalid']);
  assert.deepEqual(recipients, ['borrower@example.invalid']);
  const audit = fixture.storage.tables.AuditLogs.find((entry) => entry.action === 'LOAN_CREATED');
  assert.equal(audit.actor_user_id, admin.id);
  assert.equal(JSON.parse(audit.after_data).serviceMode, true);
  assert.equal(
    (await post(adminToken, { ...body, email: 'different@example.invalid' })).status,
    409,
  );
  assert.equal(
    (
      await post(fixture.token, {
        ...body,
        requestId: 'service-002',
        identifier: 'A2',
        selectedAsset: { asset: 'A2', serial: 'SN2' },
      })
    ).status,
    200,
  );
  assert.equal(grids.loans[2][3], 'Service Borrower');
  assert.equal(
    (
      await post(staffToken, {
        ...body,
        serviceMode: false,
        requestId: 'staff-normal',
        identifier: 'A3',
        selectedAsset: { asset: 'A3', serial: 'SN3' },
      })
    ).status,
    200,
  );
  assert.equal(grids.loans[3][3], 'Staff');
  assert.equal(emails.at(-1), 'staff@example.invalid');
  assert.equal(recipients.at(-1), 'staff@example.invalid');
  const borrowerToken = await fixture.sessions.login({
    sub: 'borrower',
    name: 'Service Borrower',
    email: 'BORROWER@example.invalid',
  });
  const otherToken = await fixture.sessions.login({
    sub: 'other',
    name: 'Service Borrower',
    email: 'other@example.invalid',
  });
  const mine = async (token) => {
    const response = await fetch(base + '/api/my-requests', {
      headers: { Cookie: `iqi_session=${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return (await response.json()).records.map((record) => record.id);
  };
  grids.loans[1][LOAN_HEADERS.length] = ' Borrower@Example.Invalid ';
  assert.deepEqual(await mine(adminToken), [grids.loans[1][0]]);
  assert.deepEqual(await mine(fixture.token), [grids.loans[2][0]]);
  assert.deepEqual(await mine(borrowerToken), [grids.loans[1][0], grids.loans[2][0]]);
  assert.deepEqual(await mine(staffToken), [grids.loans[3][0]]);
  assert.deepEqual(await mine(otherToken), []);
  const returned = Array(RETURN_HEADERS.length).fill('');
  returned[0] = 'R-served';
  returned[1] = grids.loans[1][0];
  returned[2] = grids.loans[1][1];
  returned[14] = 'เสร็จสิ้น';
  grids.returns.push(returned);
  assert.deepEqual(await mine(adminToken), [grids.loans[1][0], 'R-served']);
  assert.deepEqual(await mine(borrowerToken), [grids.loans[1][0], grids.loans[2][0], 'R-served']);
  assert.deepEqual(await mine(otherToken), []);
});
