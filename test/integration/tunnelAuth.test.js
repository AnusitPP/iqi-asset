import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { loadConfig } from '../../backend/src/core/config/loadConfig.js';
import { loadGoogleAuthConfig } from '../../backend/src/core/config/google-auth.config.js';
import { TestAuthStorage } from '../helpers/authStorage.js';

test('configured HTTPS tunnel owns callback, secure cookies and allowed browser origin', async (t) => {
  const env = {
    APP_URL: 'https://tunnel.example',
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_ALLOWED_DOMAIN: 'step.cmu.ac.th',
    AUTH_SPREADSHEET_ID: 'test-sheet',
  };
  const config = {
    ...loadConfig(env),
    host: '127.0.0.1',
    authStorage: new TestAuthStorage(),
    googleAuth: loadGoogleAuthConfig(env),
  };
  assert.ok(config.allowedHosts.includes('tunnel.example'));
  const server = createApp({ adapter: {} }, config).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  assert.equal(start.status, 302);
  assert.equal(
    new URL(start.headers.get('location')).searchParams.get('redirect_uri'),
    'https://tunnel.example/api/auth/google/callback',
  );
  for (const cookie of start.headers.getSetCookie()) {
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /Path=\/api\/auth\/google/);
  }
  const session = await fetch(base + '/api/auth/session').then((r) => r.json());
  for (const [origin, expected] of [
    ['https://tunnel.example', 200],
    ['https://evil.example', 403],
  ]) {
    const response = await fetch(base + '/api/auth/logout', {
      method: 'POST',
      headers: { Origin: origin, 'X-IQI-Request': session.csrf },
    });
    assert.equal(response.status, expected);
  }
});
