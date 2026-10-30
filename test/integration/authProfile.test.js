import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createApp } from '../../backend/src/http/app.js';
import { signToken } from '../../backend/src/core/security/tokens.js';

test('session exposes only verified session name and clears profile after logout', async t => {
  const appSecret = 'test-secret-for-profile-only-32-characters';
  const password = 'test-password';
  const secret = createHmac('sha256', appSecret).update('iqi:session:').update(password).digest('hex');
  const server = createApp({ adapter: {} }, { host: '127.0.0.1', appSecret, password }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const signed = signToken({ purpose: 'session', id: 'profile-test', expires: Date.now() + 60000,
    user: { name: 'Test User', email: 'user@step.cmu.ac.th', sub: 'private-subject' } }, secret);
  const headers = { Cookie: `iqi_session=${signed}` };
  const session = await fetch(base + '/api/auth/session', { headers }).then(r => r.json());
  assert.equal(session.authenticated, true);
  assert.deepEqual(session.user, { name: 'Test User' });
  const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { ...headers, 'X-IQI-Request': session.csrf } });
  assert.equal(logout.status, 200);
  const revoked = await fetch(base + '/api/auth/session', { headers }).then(r => r.json());
  assert.equal(revoked.authenticated, false);
  assert.equal(revoked.user, null);
  const forged = await fetch(base + '/api/auth/session', { headers: { Cookie: `iqi_session=${signed}tampered` } }).then(r => r.json());
  assert.equal(forged.user, null);
});
