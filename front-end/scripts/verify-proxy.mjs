// Isolated transport acceptance test: real unchanged Express + Next, fixture adapter only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
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
  appendLoanRows: async (name, rows) => {
    ledger[name].push(...structuredClone(rows));
  },
  initialize: async () => {},
  readDashboard: async () => structuredClone(grid),
  writeDashboardDetails: async (row, changes) => {
    for (const change of changes) grid[row - 1][change.column] = change.value;
  },
};
const backend = createApp(
  { adapter },
  {
    host: '127.0.0.1',
    sheets: ['IQI', 'รายการทั้งหมด', 'all'],
    password: 'transport-fixture-password',
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
      const response = await fetch(base + '/api/auth/session');
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
  const session = await fetch(base + '/api/auth/session').then((r) => r.json());
  assert.equal(session.authenticated, false);
  const headers = {
    'Content-Type': 'application/json',
    'X-IQI-Request': session.csrf,
    Origin: base,
  };
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: 'transport-fixture-password' }),
  });
  assert.equal(login.status, 200, await login.text());
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);
  const authenticated = { ...headers, Cookie: cookie };
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
  const returned = await fetch(base + '/api/returns', {
    method: 'POST',
    headers: authenticated,
    body: JSON.stringify({ ...selection, requestId: randomUUID(), date: '2026-11-01' }),
  });
  assert.equal(returned.status, 200);
  assert.match((await returned.json()).id, /^R-/);
  assert.equal(ledger.returns.length, 2);
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
    'PASS: Next→Express session, login cookie, authenticated GET, revision PUT, foreign Origin rejection, CSRF rejection, logout/revocation, catalog, loan/return submissions, loan idempotency, and all page HTTP responses. Fixtures only; no Google API calls.',
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
