import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../helpers/lending.js';
test('form endpoints save dropdown fields and pending return without staff or active loan', async (t) => {
  const grids = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    appendLoanRows: async (k, r) => grids[k].push(...r),
  };
  const server = createApp({ adapter }, { host: '127.0.0.1' }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`,
    session = await fetch(base + '/api/auth/session').then((r) => r.json());
  const headers = { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf };
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: '1234' }),
  });
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  const body = {
    requestId: 'form-http-001',
    borrower: 'ทดสอบ',
    team: 'IQI',
    category: 'อื่นๆ',
    identifier: '-',
    purpose: 'ประชุม',
    start: '2026-10-29',
    due: '2026-10-30',
    notes: '',
  };
  assert.equal(
    (await fetch(base + '/api/loans', { method: 'POST', headers, body: JSON.stringify(body) }))
      .status,
    200,
  );
  assert.equal(grids.loans[1][6], 'อื่นๆ');
  assert.equal(grids.loans[1][7], '-');
  assert.equal(
    (
      await fetch(base + '/api/returns', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, requestId: 'form-http-002', date: '2026-10-29' }),
      })
    ).status,
    200,
  );
  assert.equal(grids.returns[1][14], 'รอรับคืน');
  assert.equal(grids.returns[1][13], '');
});
