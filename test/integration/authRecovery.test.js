import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { testSession } from '../helpers/session.js';

test('reset requires CSRF, revokes only the current session and clears login cookies', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const other = await fixture.sessions.login({
    sub: 'other',
    email: 'other@example.invalid',
    name: 'Other',
  });
  const server = createApp({ adapter: {} }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await fetch(base + '/api/auth/recovery').then((r) => r.json());
  const cancelled = await fetch(
    base + '/api/auth/google/callback?error=access_denied&state=' + 'a'.repeat(43),
    {
      redirect: 'manual',
      headers: { Cookie: 'google_oauth_state=' + 'a'.repeat(43) },
    },
  );
  assert.equal(cancelled.status, 303);
  assert.equal(cancelled.headers.get('location'), '/error');
  assert.equal((await fetch(base + '/api/auth/reset', { method: 'POST' })).status, 403);
  assert.equal(
    (
      await fetch(base + '/api/auth/reset', {
        method: 'POST',
        headers: { 'X-IQI-Request': csrf, Origin: 'https://untrusted.example' },
      })
    ).status,
    403,
  );
  const response = await fetch(base + '/api/auth/reset', {
    method: 'POST',
    headers: { 'X-IQI-Request': csrf, Cookie: fixture.cookie },
  });
  assert.equal(response.status, 200);
  for (const name of ['iqi_session', 'google_oauth_state', 'google_oauth_nonce'])
    assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith(name + '=;')));
  assert.equal(await fixture.sessions.read(fixture.token), null);
  assert.ok(await fixture.sessions.read(other));
  fixture.storage.read = async () => {
    throw new Error('storage unavailable');
  };
  const fallback = await fetch(base + '/api/auth/reset', {
    method: 'POST',
    headers: { 'X-IQI-Request': csrf, Cookie: `iqi_session=${other}` },
  });
  assert.equal(fallback.status, 200);
  assert.ok(fallback.headers.getSetCookie().some((cookie) => cookie.startsWith('iqi_session=;')));
});
