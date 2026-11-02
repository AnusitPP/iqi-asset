// Same-project Next + existing Express smoke test. No Google API requests or writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const reservation = net.createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const address = reservation.address();
assert(address && typeof address !== 'string');
await new Promise((resolve) => reservation.close(resolve));
const base = `http://localhost:${address.port}`;
let output = '';
const child = spawn(
  process.env.npm_node_execpath || process.execPath,
  [
    fileURLToPath(new URL('../../node_modules/next/dist/bin/next', import.meta.url)),
    'dev',
    '--webpack',
    '--port',
    String(address.port),
  ],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      VERCEL: '1',
      IQI_PROXY_TEST: '1',
      IQI_BACKEND_ORIGIN: 'http://127.0.0.1:1',
      APP_PASSWORD: 'embedded-api-fixture',
      AUTH_SPREADSHEET_ID: 'fixture-auth-sheet',
      GOOGLE_CLIENT_ID: 'fixture-client',
      GOOGLE_CLIENT_SECRET: 'fixture-secret',
      GOOGLE_ALLOWED_DOMAIN: 'example.invalid',
      APP_URL: base,
      APP_SECRET: 'embedded-api-fixture-secret-'.repeat(3),
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'fixture@example.invalid',
        private_key: 'fixture-not-a-real-key',
      }),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Next exited before becoming ready');
    if (output.includes('Ready in')) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, 'Next did not become ready');
  const sessionResponse = await fetch(base + '/api/auth/me', {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(sessionResponse.status, 200, await sessionResponse.clone().text());
  const session = await sessionResponse.json();
  assert.equal(session.authenticated, false);
  assert.equal(typeof session.csrf, 'string');
  const headers = {
    Origin: base,
    'Content-Type': 'application/json',
    'X-IQI-Request': session.csrf,
  };
  const login = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  assert.equal(login.status, 302);
  const authorization = new URL(login.headers.get('location'));
  assert.equal(authorization.hostname, 'accounts.google.com');
  assert.equal(authorization.searchParams.get('redirect_uri'), base + '/api/auth/google/callback');
  const cookie = login.headers.get('set-cookie');
  assert(cookie);
  assert.match(cookie, /google_oauth_state/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  const password = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: 'embedded-api-fixture' }),
  });
  assert.equal(password.status, 410);
  const uploadConfig = await fetch(base + '/api/upload-config').then((response) => response.json());
  assert.equal(uploadConfig.maxUploadBytes, 4 * 1024 * 1024);
  const malformed = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers,
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get('content-type'), /application\/json/);
  const wrongCsrf = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...headers, 'X-IQI-Request': 'wrong' },
  });
  assert.equal(wrongCsrf.status, 403);
  const foreignOrigin = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: { ...headers, Origin: 'https://foreign.invalid' },
  });
  assert.equal(foreignOrigin.status, 403);
  for (const path of [
    '/login',
    '/dashboard',
    '/assets',
    '/loans',
    '/returns',
    '/my-requests',
    '/users',
    '/audit',
  ]) {
    const page = await fetch(base + path);
    assert.equal(page.status, 200, path);
    assert.match(await page.text(), /_next\/static/);
  }
  const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(base + '/api/dashboard', { headers })).status, 401);
  console.log(
    'PASS: same-project Next frontend + original Express API, hosted-mode Google OAuth redirect/cookie, password bypass rejection and anonymous session/logout, JSON stream parsing, CSRF/Origin rejection, protected API and upload config; external backend origin ignored. No Google API calls.',
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
}
