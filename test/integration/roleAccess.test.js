import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../backend/src/http/app.js';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { TestAuthStorage } from '../helpers/authStorage.js';

test('three roles enforce page-related API access while staff can borrow, return and view only their requests', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-02T01:00:00Z') });
  const storage = new TestAuthStorage();
  const config = {
    confirmLoan: async () => 'sent',
    host: '127.0.0.1',
    sheets: [],
    authStorage: storage,
    bootstrapSuperAdminEmail: 'owner@example.invalid',
  };
  const sessions = new SheetSessionService(storage, config);
  const tokens = {};
  for (const sub of ['owner', 'admin', 'staff'])
    tokens[sub] = await sessions.login({ sub, email: `${sub}@example.invalid`, name: sub });
  const adminId = storage.tables.Users.find((user) => user.google_sub === 'admin').id;
  await storage.write([
    {
      table: 'Admins',
      values: {
        id: 'admin-grant',
        user_id: adminId,
        email: 'admin@example.invalid',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    },
  ]);
  const ledger = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const catalog = [
    ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
    ['A1', 'S1', 'Mouse'],
  ];
  const writes = [];
  const reportRow = ['A1', 'Mouse'];
  const adapter = {
    readAssetReportExport: async () => [['เลขครุภัณฑ์', 'ชื่ออุปกรณ์'], reportRow],
    appendAssetReportEntry: async () => writes.push('add'),
    trashAssetReportEntry: async () => writes.push('trash'),
    initialize: async () => {},
    readReadyToBorrow: async () => structuredClone(catalog),
    readLoanSheets: async () => structuredClone(ledger),
    appendLoanRows: async (kind, rows) => ledger[kind].push(...structuredClone(rows)),
    updateLoanStatus: async (id, status, responsible) => {
      const row = ledger.loans.find((row) => row[0] === id);
      assert.ok(row, 'approval must reference a saved loan');
      row[14] = status;
      row[15] = responsible;
    },
    readDashboard: async () => [
      ['ผลตรวจ Apps Script', 'สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script', 'ทีม'],
      ['ดี', 'ตรงกัน', 'A1', 'IT'],
    ],
  };
  const server = createApp({ adapter }, config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = (role) => ({ Cookie: `iqi_session=${tokens[role]}` });
  const matrix = [
    ['/api/loan-catalog', 200, 200, 200],
    ['/api/return-catalog', 200, 200, 200],
    ['/api/my-requests', 200, 200, 200],
    ['/api/status', 403, 200, 200],
    ['/api/loans', 403, 200, 200],
    ['/api/admin/users', 403, 200, 200],
    ['/api/audit', 403, 403, 200],
  ];
  for (const [path, ...statuses] of matrix) {
    for (const [index, role] of ['staff', 'admin', 'owner'].entries()) {
      const response = await fetch(base + path, { headers: headers(role) });
      assert.equal(response.status, statuses[index], `${role}: ${path}`);
    }
  }
  const staffMe = await fetch(base + '/api/auth/me', { headers: headers('staff') }).then(
    (response) => response.json(),
  );
  const adminMe = await fetch(base + '/api/auth/me', { headers: headers('admin') }).then(
    (response) => response.json(),
  );
  assert.deepEqual(staffMe.user.permissions, ['LOAN_CREATE', 'LOAN_VIEW_OWN', 'RETURN_CREATE']);
  assert.equal(adminMe.user.role, 'ADMIN');
  assert(!adminMe.user.permissions.includes('AUDIT_VIEW'));
  assert(adminMe.user.permissions.includes('USER_VIEW'));
  for (const [role, csrf, status] of [
    ['staff', staffMe.csrf, 403],
    ['admin', adminMe.csrf, 400],
    ['owner', adminMe.csrf, 400],
  ]) {
    const response = await fetch(base + '/api/mail/send', {
      method: 'POST',
      headers: { ...headers(role), 'Content-Type': 'application/json', 'X-IQI-Request': csrf },
      body: JSON.stringify({ email: 'invalid', type: 'summary' }),
    });
    assert.equal(response.status, status, `${role}: mail access`);
  }
  const denied = await fetch(`${base}/api/admin/users/${staffMe.user.id}/role`, {
    method: 'PATCH',
    headers: {
      ...headers('admin'),
      'Content-Type': 'application/json',
      'X-IQI-Request': adminMe.csrf,
    },
    body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert.equal(denied.status, 403);
  const input = {
    borrower: 'ignored',
    team: 'IQI',
    category: 'เมาส์ (Mouse)',
    identifier: 'A1',
    selectedAsset: { asset: 'A1', serial: 'S1' },
    notes: '',
  };
  for (const [path, values] of [
    ['/api/loans', { purpose: 'fixture', start: '2026-11-02', due: '2026-11-09' }],
    ['/api/returns', { date: '2026-11-03' }],
  ]) {
    if (path === '/api/returns') {
      const pendingReturn = await fetch(base + path, {
        method: 'POST',
        headers: {
          ...headers('staff'),
          'Content-Type': 'application/json',
          'X-IQI-Request': staffMe.csrf,
        },
        body: JSON.stringify({ ...input, ...values, requestId: randomUUID() }),
      });
      assert.equal(pendingReturn.status, 409);
      assert.equal(ledger.returns.length, 1, 'pending loans must not create a return');
      const loanId = ledger.loans[1][0];
      const approval = await fetch(`${base}/api/approval-requests/${loanId}`, {
        method: 'PATCH',
        headers: {
          ...headers('admin'),
          'Content-Type': 'application/json',
          'X-IQI-Request': adminMe.csrf,
        },
        body: JSON.stringify({ status: 'กำลังยืม', kind: 'ยืม' }),
      });
      assert.equal(approval.status, 200, await approval.text());
      assert.equal(ledger.loans[1][14], 'กำลังยืม');
    }
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        ...headers('staff'),
        'Content-Type': 'application/json',
        'X-IQI-Request': staffMe.csrf,
      },
      body: JSON.stringify({ ...input, ...values, requestId: randomUUID() }),
    });
    assert.equal(response.status, 200, await response.text());
  }
  const own = await fetch(base + '/api/my-requests', { headers: headers('staff') }).then(
    (response) => response.json(),
  );
  const others = await fetch(base + '/api/my-requests', { headers: headers('admin') }).then(
    (response) => response.json(),
  );
  assert.equal(own.records.length, 2);
  assert.equal(others.records.length, 0);

  const request = (role, path, method = 'GET', body, extraHeaders = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...headers(role),
        'Content-Type': 'application/json',
        'X-IQI-Request': adminMe.csrf,
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const permissionsUrl = '/api/admin/users/' + adminId + '/permissions';
  const report = '/api/sheets/asset-report';
  const add = { assetNumber: 'A2', name: 'Monitor', updatedAt: '2026-11-26T10:00' };
  const trash = { row: 2, values: reportRow };
  assert.equal((await request('admin', report)).status, 200);
  assert.equal((await request('admin', report + '/export?format=csv')).status, 200);
  assert.equal((await request('admin', report, 'POST', add)).status, 403);
  assert.equal((await request('admin', report + '/trash', 'POST', trash)).status, 403);
  assert.equal((await request('admin', permissionsUrl, 'PATCH', { permissions: [] })).status, 403);
  assert.equal(
    (await request('owner', permissionsUrl, 'PATCH', { permissions: ['USER_MANAGE'] })).status,
    400,
  );

  const patch = (permissions) => request('owner', permissionsUrl, 'PATCH', { permissions });
  assert.equal(
    (await patch(['SHEETS_VIEW', 'SHEETS_ADD', 'MAIL_VIEW', 'LOAN_VIEW_ALL'])).status,
    200,
  );
  assert.equal((await request('admin', report)).status, 200);
  assert.equal((await request('admin', report + '/export?format=csv')).status, 403);
  assert.equal((await request('admin', report, 'POST', add)).status, 201);
  assert.equal((await request('admin', report + '/trash', 'POST', trash)).status, 403);
  assert.equal((await request('admin', '/api/mail/send', 'POST', {})).status, 403);
  assert.equal((await request('admin', '/api/mail/mockup', 'POST', { groups: [] })).status, 200);
  assert.equal((await request('admin', '/api/admin/users')).status, 403);
  assert.equal((await request('admin', '/api/approval-requests')).status, 200);
  assert.equal(
    (
      await request('admin', '/api/approval-requests/' + ledger.loans[1][0], 'PATCH', {
        status: 'ไม่อนุมัติ',
      })
    ).status,
    403,
  );

  assert.equal((await patch(['SHEETS_VIEW', 'SHEETS_TRASH'])).status, 200);
  assert.equal((await request('admin', report + '/trash', 'POST', trash)).status, 200);
  assert.equal((await request('admin', report, 'POST', add)).status, 403);
  assert.equal((await request('admin', '/api/approval-requests')).status, 403);
  assert.equal((await patch(['SHEETS_TRASH'])).status, 200);
  assert.equal((await request('admin', '/API/SHEETS/asset-report/')).status, 403);
  assert.equal((await request('admin', report + '/trash', 'POST', trash)).status, 403);
  assert.equal(
    (await request('admin', '/api/status').then((response) => response.json())).spreadsheetUrl,
    undefined,
  );
  assert.deepEqual(writes, ['add', 'trash']);
  assert.equal(
    storage.tables.AuditLogs.filter(({ action }) => action === 'USER_PERMISSIONS_CHANGED').length,
    3,
  );

  for (const [role, previewRole, path, status] of [
    ['owner', 'STAFF', report, 403],
    ['owner', 'STAFF', '/api/loan-catalog', 200],
    ['owner', 'ADMIN', report, 200],
    ['owner', 'ADMIN', '/api/audit', 403],
    ['admin', 'STAFF', '/api/loan-catalog', 403],
    ['owner', 'SUPER_ADMIN', report, 403],
  ]) {
    assert.equal(
      (await request(role, path, 'GET', undefined, { 'X-IQI-Preview-Role': previewRole })).status,
      status,
    );
  }
  assert.equal(
    (
      await request(
        'owner',
        permissionsUrl,
        'PATCH',
        { permissions: [] },
        { 'X-IQI-Preview-Role': 'ADMIN' },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request('owner', report, 'POST', add, { 'X-IQI-Preview-Role': 'ADMIN' })).status,
    403,
  );
  assert.equal((await request('owner', '/api/audit')).status, 200);
  assert.deepEqual(writes, ['add', 'trash']);
});
