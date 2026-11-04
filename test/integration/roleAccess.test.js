import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../backend/src/http/app.js';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { TestAuthStorage } from '../helpers/authStorage.js';

test('three roles enforce page-related API access while staff can borrow, return and view only their requests', async (t) => {
  const storage = new TestAuthStorage();
  const config = {
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
  const adapter = {
    initialize: async () => {},
    readReadyToBorrow: async () => structuredClone(catalog),
    readBorrowedAssets: async () => structuredClone(catalog),
    readLoanSheets: async () => structuredClone(ledger),
    appendLoanRows: async (kind, rows) => ledger[kind].push(...structuredClone(rows)),
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
    ['/api/status', 200, 200, 200],
    ['/api/dashboard', 403, 200, 200],
    ['/api/loans', 403, 200, 200],
    ['/api/admin/users', 403, 403, 200],
    ['/api/audit', 403, 200, 200],
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
  assert.deepEqual(staffMe.user.permissions, [
    'ASSET_VIEW',
    'LOAN_CREATE',
    'LOAN_VIEW_OWN',
    'RETURN_CREATE',
  ]);
  assert.equal(adminMe.user.role, 'ADMIN');
  assert(adminMe.user.permissions.includes('AUDIT_VIEW'));
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
});
