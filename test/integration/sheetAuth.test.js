import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';
import { TestAuthStorage } from '../helpers/authStorage.js';
test('sheet auth exposes current profile, disables password bypass and enforces API permissions', async (t) => {
  const authStorage = new TestAuthStorage();
  const sessions = new SheetSessionService(authStorage, {});
  const token = await sessions.login({
    sub: 'staff',
    email: 'staff@step.cmu.ac.th',
    name: 'Staff',
  });
  let reads = 0;
  const server = createApp(
    {
      adapter: {},
      ready: () => {
        reads++;
      },
    },
    { host: '127.0.0.1', authStorage },
  ).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: `iqi_session=${token}` };
  const me = await fetch(base + '/api/auth/me', { headers }).then((r) => r.json());
  assert.equal(me.user.name, 'Staff');
  assert.equal(me.user.role, 'STAFF');
  assert.ok(!('google_sub' in me.user));
  assert.ok(!JSON.stringify(me).includes(token));
  assert.equal(reads, 0);
  for (const path of ['/api/admin/users', '/api/dashboard', '/api/loans', '/api/audit']) {
    const response = await fetch(base + path, { headers });
    assert.equal(response.status, 403, path);
  }
  assert.equal(reads, 0);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'X-IQI-Request': me.csrf },
  });
  assert.equal(login.status, 410);
  const logout = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...headers, 'X-IQI-Request': me.csrf },
  });
  assert.equal(logout.status, 200);
  const again = await fetch(base + '/api/auth/me', { headers }).then((r) => r.json());
  assert.equal(again.authenticated, false);
  assert.equal(again.user, null);
});
