import test from 'node:test';
import assert from 'node:assert/strict';
import { google } from 'googleapis';
import { createApp } from '../../backend/src/http/app.js';
import { loadConfig } from '../../backend/src/core/config/loadConfig.js';
import { loadGoogleAuthConfig } from '../../backend/src/core/config/google-auth.config.js';
import { TestAuthStorage } from '../helpers/authStorage.js';

test('Google callback stays on the backend port and redirects a signed-in user to the frontend', async (t) => {
  const env = {
    APP_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3001',
    AUTH_SPREADSHEET_ID: 'fixture-auth-sheet',
    GOOGLE_CLIENT_ID: 'fixture-client',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    GOOGLE_ALLOWED_DOMAIN: 'example.invalid',
  };
  const config = {
    ...loadConfig(env),
    host: '127.0.0.1',
    authStorage: new TestAuthStorage(),
    googleAuth: loadGoogleAuthConfig(env),
  };
  let nonce;
  t.mock.method(google.auth.OAuth2.prototype, 'getToken', async (code) => {
    assert.equal(code, 'fixture-code');
    return { tokens: { id_token: 'fixture-token' } };
  });
  t.mock.method(google.auth.OAuth2.prototype, 'verifyIdToken', async () => ({
    getPayload: () => ({
      sub: 'fixture-google-user',
      email: 'staff@example.invalid',
      name: 'Fixture Staff',
      email_verified: true,
      hd: 'example.invalid',
      nonce,
    }),
  }));
  const server = createApp({ adapter: {} }, config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorization = new URL(start.headers.get('location'));
  assert.equal(
    authorization.searchParams.get('redirect_uri'),
    'http://localhost:3000/api/auth/google/callback',
  );
  nonce = authorization.searchParams.get('nonce');
  const cookies = start.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
  const callback = await fetch(
    base +
      '/api/auth/google/callback?' +
      new URLSearchParams({
        code: 'fixture-code',
        state: authorization.searchParams.get('state'),
        next: 'https://untrusted.example',
      }),
    { redirect: 'manual', headers: { Cookie: cookies } },
  );
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), 'http://localhost:3001/');
  const sessionCookie = callback.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('iqi_session='));
  assert(sessionCookie);
  const me = await fetch(base + '/api/auth/me', {
    headers: { Cookie: sessionCookie.split(';')[0] },
  }).then((response) => response.json());
  assert.equal(me.authenticated, true);
  assert.equal(me.user.name, 'Fixture Staff');
});

test('frontend return origin is optional and must be a configured valid origin', () => {
  assert.equal(loadConfig({ APP_URL: 'http://localhost:3000' }).frontendOrigin, undefined);
  for (const value of [
    'javascript:alert(1)',
    '//untrusted.example',
    'http://untrusted.example',
    'http://localhost:3001/path',
    'https://user:password@example.com',
  ])
    assert.throws(() => loadConfig({ FRONTEND_URL: value }), /FRONTEND_URL/);
});
