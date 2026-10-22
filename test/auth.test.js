import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
test('password popup is backed by API authentication, expiring sessions and rate limits', async (t) => {
  let reads = 0;
  const service = {
    adapter: {
      initialize: async () => {
        reads++;
      },
    },
    search: async () => {
      reads++;
      return { groups: [] };
    },
    detail: async () => {
      reads++;
      return {};
    },
    save: async () => {
      reads++;
      return {};
    },
  };
  const app = createApp(service, {
    host: '0.0.0.0',
    sheets: ['IQI', 'รายการทั้งหมด', 'all'],
    password: '1234',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of [
      '/api/status',
      '/api/dashboard',
      '/api/search?q=0',
      '/api/record?sheet=IQI&row=2',
      '/api/review-inspection?sheet=IQI&row=2',
    ])
      assert.equal((await fetch(base + route)).status, 401);
    const session = await fetch(base + '/api/auth/session').then((r) => r.json());
    assert.equal(session.authenticated, false);
    const login = (password, extra = {}) =>
      fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf, ...extra },
        body: JSON.stringify({ password }),
      });
    assert.equal((await login('bad')).status, 401);
    assert.equal((await login('1234', { Origin: 'https://other.example' })).status, 403);
    assert.equal((await login('1234', { 'X-IQI-Request': 'bad' })).status, 403);
    assert.equal(reads, 0);
    const success = await login('1234');
    assert.equal(success.status, 200);
    const cookie = success.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Max-Age=28800/i);
    const headers = { Cookie: cookie.split(';')[0], 'X-IQI-Request': session.csrf };
    assert.equal((await fetch(base + '/api/status', { headers })).status, 200);
    assert.equal(
      (
        await fetch(base + '/api/iqi/2', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
          body: '{}',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + '/api/iqi/2/search-status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
          body: '{}',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + '/api/review-selection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
          body: '{}',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + '/api/review-inspection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
          body: '{}',
        })
      ).status,
      401,
    );
    assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers })).status, 200);
    assert.equal((await fetch(base + '/api/search?q=0', { headers })).status, 401);
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    for (let i = 0; i < 4; i++) await login('bad');
    now += 59000;
    await login('bad');
    now += 2000;
    assert.equal((await login('1234')).status, 429);
    now += 60000;
    const renewed = await login('1234');
    assert.equal(renewed.status, 200);
    const renewedCookie = renewed.headers.get('set-cookie').split(';')[0];
    now += 8 * 60 * 60 * 1000 + 1;
    assert.equal(
      (await fetch(base + '/api/status', { headers: { Cookie: renewedCookie } })).status,
      401,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
