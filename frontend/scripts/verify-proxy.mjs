// Isolated transport acceptance test: real unchanged Express + Next, fixture adapter only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';
import { TestAuthStorage } from '../../test/helpers/authStorage.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { createApp } from '../../backend/src/http/app.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const grid = [
  [
    'ผลตรวจ Apps Script',
    'สถานะการเทียบ',
    'เลขครุภัณฑ์ Apps Script',
    'ทีม',
    'หมายเหตุ',
    'วันที่อัปเดตจากเว็บ',
  ],
  ['ดี', 'ตรงกัน', 'TEST-001', 'IQI', '', ''],
  ['ชำรุด', 'ตรงกัน', 'TEST-002', 'IT', '', ''],
];
const ledger = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
const adapter = {
  readReadyToBorrow: async () => [
    ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
    ['FIXTURE-MOUSE', 'SN-001', 'Mouse'],
  ],
  readLoanSheets: async () => structuredClone(ledger),
  readBorrowedAssets: async () => structuredClone(ledger.loans),
  appendLoanRows: async (name, rows) => {
    ledger[name].push(...structuredClone(rows));
  },
  initialize: async () => {},
  readDashboard: async () => structuredClone(grid),
  writeDashboardDetails: async (row, changes) => {
    for (const change of changes) grid[row - 1][change.column] = change.value;
  },
};
const authStorage = new TestAuthStorage();
const authConfig = { authStorage, bootstrapSuperAdminEmail: 'owner@example.invalid' };
const sessions = new SheetSessionService(authStorage, authConfig);
const ownerToken = await sessions.login({
  sub: 'fixture-owner',
  email: 'owner@example.invalid',
  name: 'Fixture Owner',
});
const staffToken = await sessions.login({
  sub: 'fixture-staff',
  email: 'staff@example.invalid',
  name: 'Fixture Staff',
});
const backend = createApp(
  { adapter },
  {
    host: '127.0.0.1',
    sheets: ['IQI', 'รายการทั้งหมด', 'all'],
    ...authConfig,
  },
).listen(0, '127.0.0.1');
await once(backend, 'listening');
const address = backend.address();
assert(address && typeof address !== 'string');
const portFinder = net.createServer().listen(0, '127.0.0.1');
await once(portFinder, 'listening');
const frontendAddress = portFinder.address();
assert(frontendAddress && typeof frontendAddress !== 'string');
await new Promise((resolve) => portFinder.close(resolve));
const base = `http://localhost:${frontendAddress.port}`;
let output = '';
const next = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../../node_modules/next/dist/bin/next', import.meta.url)),
    'dev',
    '--webpack',
    '--port',
    String(frontendAddress.port),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      IQI_BACKEND_ORIGIN: `http://127.0.0.1:${address.port}`,
      NEXT_TELEMETRY_DISABLED: '1',
      IQI_PROXY_TEST: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
next.stdout.on('data', (data) => {
  output += data.toString();
});
next.stderr.on('data', (data) => {
  output += data.toString();
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (next.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(base + '/api/auth/me');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, 'Next dev did not become ready: ' + output);
  const session = await fetch(base + '/api/auth/me').then((r) => r.json());
  assert.equal(session.authenticated, false);
  const headers = {
    'Content-Type': 'application/json',
    'X-IQI-Request': session.csrf,
    Origin: base,
  };
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: 'no-password-bypass' }),
  });
  assert.equal(login.status, 410);
  const authenticated = { ...headers, Cookie: `iqi_session=${ownerToken}` };
  const me = await fetch(base + '/api/auth/me', { headers: authenticated }).then((r) => r.json());
  assert.equal(me.user.role, 'SUPER_ADMIN');
  const staffHeaders = { ...headers, Cookie: `iqi_session=${staffToken}` };
  assert.equal((await fetch(base + '/api/dashboard', { headers: staffHeaders })).status, 403);
  assert.equal((await fetch(base + '/api/admin/users', { headers: staffHeaders })).status, 403);
  assert.equal((await fetch(base + '/api/audit', { headers: staffHeaders })).status, 403);
  const users = await fetch(base + '/api/admin/users', { headers: authenticated }).then((r) =>
    r.json(),
  );
  assert.equal(users.records.length, 2);
  assert.equal((await fetch(base + '/api/status', { headers: authenticated })).status, 200);
  const dashboard = await fetch(base + '/api/dashboard', { headers: authenticated }).then((r) =>
    r.json(),
  );
  const save = await fetch(base + '/api/dashboard/2/details', {
    method: 'PUT',
    headers: authenticated,
    body: JSON.stringify({
      revision: dashboard.records[0].revision,
      notes: 'ทดสอบ proxy เท่านั้น',
    }),
  });
  assert.equal(save.status, 200, await save.text());
  assert.equal(grid[1][4], 'ทดสอบ proxy เท่านั้น');
  const foreign = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...authenticated, Origin: 'https://foreign.invalid' },
  });
  assert.equal(foreign.status, 403);
  const csrfRejected = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...authenticated, 'X-IQI-Request': 'wrong' },
  });
  assert.equal(csrfRejected.status, 403);
  const catalog = await fetch(base + '/api/loan-catalog', { headers: authenticated }).then(
    (response) => response.json(),
  );
  assert.equal(catalog.records[0].asset, 'FIXTURE-MOUSE');
  const selection = {
    borrower: 'ทดสอบ fixture',
    team: 'IQI',
    category: 'เมาส์ (Mouse)',
    selectedAsset: { asset: 'FIXTURE-MOUSE', serial: 'SN-001' },
    identifier: 'FIXTURE-MOUSE / SN-001',
    notes: '',
  };
  const loanBody = {
    ...selection,
    requestId: randomUUID(),
    purpose: 'ทดสอบเท่านั้น',
    start: '2026-10-30',
    due: '2026-11-06',
  };
  const sendLoan = () =>
    fetch(base + '/api/loans', {
      method: 'POST',
      headers: authenticated,
      body: JSON.stringify(loanBody),
    });
  const loan = await sendLoan();
  assert.equal(loan.status, 200);
  const loanResult = await loan.json();
  assert.match(loanResult.id, /^L-/);
  const repeatedLoan = await sendLoan();
  assert.equal(repeatedLoan.status, 200);
  assert.deepEqual(await repeatedLoan.json(), { id: loanResult.id, unchanged: true });
  assert.equal(ledger.loans.length, 2);
  const returnCatalogResponse = await fetch(base + '/api/return-catalog', {
    headers: staffHeaders,
  });
  assert.equal(returnCatalogResponse.status, 200);
  const returnCatalog = await returnCatalogResponse.json();
  assert.equal(returnCatalog.records[0].asset, 'FIXTURE-MOUSE');
  assert.equal(returnCatalog.records[0].serial, 'SN-001');
  const returned = await fetch(base + '/api/returns', {
    method: 'POST',
    headers: authenticated,
    body: JSON.stringify({ ...selection, requestId: randomUUID(), date: '2026-11-01' }),
  });
  assert.equal(returned.status, 200);
  assert.match((await returned.json()).id, /^R-/);
  assert.equal(ledger.returns.length, 2);
  const own = await fetch(base + '/api/my-requests', { headers: authenticated }).then((r) =>
    r.json(),
  );
  assert.equal(own.records.length, 2);
  const audit = await fetch(base + '/api/audit', { headers: authenticated }).then((r) => r.json());
  assert(audit.records.some((entry) => entry.action === 'LOAN_CREATED'));
  assert(audit.records.some((entry) => entry.action === 'RETURN_CREATED'));
  for (const path of ['/my-requests', '/users', '/audit'])
    assert.equal((await fetch(base + path)).status, 200);
  assert.equal((await fetch(base + '/loans')).status, 200);
  assert.equal((await fetch(base + '/returns')).status, 200);
  assert.equal((await fetch(base + '/login')).status, 200);
  assert.equal((await fetch(base + '/assets')).status, 200);
  assert.equal((await fetch(base + '/dashboard')).status, 200);
  assert.equal(
    (await fetch(base + '/api/auth/logout', { method: 'POST', headers: authenticated })).status,
    200,
  );
  assert.equal((await fetch(base + '/api/dashboard', { headers: authenticated })).status, 401);
  console.log(
    'PASS: Next→Express Google Sheet-backed sessions, STAFF permission rejection, password bypass rejection, authenticated GET, revision PUT, foreign Origin rejection, CSRF rejection, logout/revocation, catalog, loan/return submissions, loan idempotency, and all page HTTP responses. Fixtures only; no Google API calls.',
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (next.exitCode === null) {
    const exited = once(next, 'exit');
    next.kill('SIGTERM');
    await exited;
  }
  await new Promise((resolve) => backend.close(resolve));
}
