import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { testSession } from '../helpers/session.js';

test('session exposes verified Google profile without tokens and clears it after logout', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  const server = createApp({ adapter: {} }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: fixture.cookie };
  const session = await fetch(base + '/api/auth/session', { headers }).then((res) => res.json());
  assert.equal(session.authenticated, true);
  assert.equal(session.user.name, 'Fixture Owner');
  assert.equal(session.user.email, 'owner@example.invalid');
  assert.equal(session.user.role, 'SUPER_ADMIN');
  assert.ok(!JSON.stringify(session).includes(fixture.token));
  const logout = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...headers, 'X-IQI-Request': session.csrf },
  });
  assert.equal(logout.status, 200);
  for (const cookie of [fixture.cookie, fixture.cookie + 'tampered']) {
    const res = await fetch(base + '/api/auth/session', { headers: { Cookie: cookie } }).then(
      (res) => res.json(),
    );
    assert.equal(res.authenticated, false);
    assert.equal(res.user, null);
  }
});
