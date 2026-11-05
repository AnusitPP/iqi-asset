import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { testSession } from '../helpers/session.js';

test('Google sessions protect API access, reject password login and enforce CSRF, revocation and expiry', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1', sheets: ['IQI', 'items', 'all'] });
  let reads = 0;
  const server = createApp(
    {
      adapter: {
        initialize: async () => {
          reads++;
        },
      },
    },
    fixture.config,
  ).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of [
    '/api/status',
    '/api/dashboard',
    '/api/search?q=0',
    '/api/record?sheet=IQI&row=2',
  ])
    assert.equal((await fetch(base + path)).status, 401);
  const session = await fetch(base + '/api/auth/session').then((res) => res.json());
  assert.equal(session.authenticated, false);
  const headers = {
    Cookie: fixture.cookie,
    'Content-Type': 'application/json',
    'X-IQI-Request': session.csrf,
  };
  for (const password of ['1234', 'bad', '']) {
    const res = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ password }),
    });
    assert.equal(res.status, 410);
    assert.equal(res.headers.get('set-cookie'), null);
  }
  for (const extra of [{ Origin: 'https://other.example' }, { 'X-IQI-Request': 'bad' }])
    assert.equal(
      (
        await fetch(base + '/api/auth/logout', {
          method: 'POST',
          headers: { ...headers, ...extra },
        })
      ).status,
      403,
    );
  assert.equal(reads, 0);
  assert.equal((await fetch(base + '/api/status', { headers })).status, 200);
  for (const path of [
    '/api/iqi/2',
    '/api/iqi/2/search-status',
    '/api/review-selection',
    '/api/review-inspection',
  ])
    assert.equal(
      (await fetch(base + path, { method: 'PUT', headers: { ...headers, Cookie: '' }, body: '{}' }))
        .status,
      401,
    );
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await fetch(base + '/api/status', { headers })).status, 401);
  const renewed = await fixture.sessions.login({
    sub: 'fixture-owner',
    email: 'owner@example.invalid',
    name: 'Fixture Owner',
  });
  const expires = fixture.storage.tables.Sessions.find((row) => !row.revoked_at).expires_at;
  t.mock.method(Date, 'now', () => Date.parse(expires) + 1);
  assert.equal(
    (await fetch(base + '/api/status', { headers: { Cookie: `iqi_session=${renewed}` } })).status,
    401,
  );
});
