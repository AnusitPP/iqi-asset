import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGoogleAuthConfig } from '../../backend/src/core/config/google-auth.config.js';
import { buildGoogleAuthorizationUrl } from '../../backend/src/integrations/google/oauth/google-oauth.client.js';
import { startGoogleLogin } from '../../backend/src/features/auth/services/google-login.service.js';
import { createApp } from '../../backend/src/http/app.js';

const config = loadGoogleAuthConfig({
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'private-test-secret',
  GOOGLE_ALLOWED_DOMAIN: 'step.cmu.ac.th',
});

test('Google authorization URL contains only login scopes and no secret', () => {
  const url = new URL(buildGoogleAuthorizationUrl(config, { state: 'state', nonce: 'nonce' }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'state',
    nonce: 'nonce',
    hd: 'step.cmu.ac.th',
    prompt: 'select_account',
  });
  assert.ok(!url.toString().includes(config.clientSecret));
  assert.ok(!url.searchParams.has('client_secret'));
});

test('OAuth values are independent and fresh for every attempt', () => {
  const a = startGoogleLogin(config),
    b = startGoogleLogin(config);
  assert.match(a.state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(a.nonce, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(new Set([a.state, a.nonce, b.state, b.nonce]).size, 4);
});

test('Google config rejects missing and malformed settings without leaking secrets', () => {
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ALLOWED_DOMAIN']) {
    const env = {
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_ALLOWED_DOMAIN: 'step.cmu.ac.th',
    };
    delete env[key];
    assert.throws(
      () => loadGoogleAuthConfig(env),
      (e) => e.status === 503 && e.publicMessage.includes(key),
    );
  }
  assert.throws(
    () =>
      loadGoogleAuthConfig({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_ALLOWED_DOMAIN: 'https://wrong/',
      }),
    /GOOGLE_ALLOWED_DOMAIN/,
  );
});

test('Google start is public, skips Sheets, sets temporary cookies and leaves old login working', async (t) => {
  const app = createApp(
    {
      adapter: {},
      ready: () => {
        throw new Error('Sheets must not be called');
      },
    },
    { host: '127.0.0.1', googleAuth: config },
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const target = new URL(response.headers.get('location'));
  const cookies = response.headers.getSetCookie();
  for (const key of ['state', 'nonce']) {
    const cookie = cookies.find((c) => c.startsWith(`google_oauth_${key}=`));
    assert.ok(cookie.startsWith(`google_oauth_${key}=${target.searchParams.get(key)};`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Max-Age=600/);
    assert.match(cookie, /Path=\/api\/auth\/google/);
  }
  const session = await fetch(base + '/api/auth/session').then((r) => r.json());
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf },
    body: JSON.stringify({ password: '1234' }),
  });
  assert.equal(login.status, 200);
});

test('hosted OAuth cookies are Secure', async (t) => {
  const server = createApp(
    { adapter: {} },
    { host: '127.0.0.1', hosted: true, googleAuth: config },
  ).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/google`, {
    redirect: 'manual',
  });
  assert.equal(response.status, 302);
  for (const cookie of response.headers.getSetCookie()) assert.match(cookie, /; Secure/);
});
