import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';
import { testSession } from '../helpers/session.js';

test('Google authenticated forms save borrower identity and allow returns only after loan approval', async (t) => {
  // Keep fixture dates valid without depending on the day the suite is run.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-05T01:00:00Z') });
  const fixture = await testSession({ host: '127.0.0.1' });
  const grids = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A1', 'S1', 'Mouse'],
    ],
    appendLoanRows: async (kind, rows) => grids[kind].push(...rows),
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(base + '/api/auth/session').then((res) => res.json());
  const headers = {
    Cookie: fixture.cookie,
    'Content-Type': 'application/json',
    'X-IQI-Request': session.csrf,
  };
  const body = {
    requestId: 'loan-http-001',
    borrower: 'forged name',
    team: 'IQI',
    category: 'เมาส์ (Mouse)',
    identifier: 'A1',
    selectedAsset: { asset: 'A1', serial: 'S1' },
    purpose: 'Meeting',
    start: '2026-11-05',
    due: '2026-11-06',
    notes: '',
  };
  const post = (path, body) =>
    fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal((await post('/api/loans', body)).status, 200);
  assert.equal(grids.loans[1][3], 'Fixture Owner');
  const returning = { ...body, requestId: 'return-http-001', date: '2026-11-06' };
  assert.equal((await post('/api/returns', returning)).status, 409);
  grids.loans[1][14] = 'กำลังยืม';
  assert.equal((await post('/api/returns', returning)).status, 200);
  assert.equal(grids.returns[1][1], grids.loans[1][0]);
  assert.equal(grids.returns[1][4], 'Fixture Owner');
  assert.equal(grids.returns[1][14], 'รอดำเนินการ');
});
