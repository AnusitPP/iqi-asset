import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../../backend/src/core/config/loadConfig.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';
import { PhotoStore } from '../../backend/src/integrations/google/photoStorage.js';
import { safeMessage, logError } from '../../backend/src/core/errors/errors.js';
import { readApiResponse } from '../../frontend/public/js/core/http/response.js';
import { StateStore } from '../../backend/src/core/state/stateStore.js';

const serviceAccount = { client_email: 'test@example.invalid', private_key: 'test-key' };
const env = {
  VERCEL: '1',
  APP_PASSWORD: 'fake-password',
  APP_SECRET: 's'.repeat(64),
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
  GOOGLE_DRIVE_OAUTH_JSON: JSON.stringify({
    installed: { client_id: 'id', client_secret: 'secret' },
    refresh_token: 'refresh',
  }),
  GOOGLE_SERVICE_ACCOUNT_FILE: '/not-present/service.json',
  GOOGLE_DRIVE_OAUTH_FILE: '/not-present/oauth.json',
  VERCEL_URL: 'preview.example',
  VERCEL_PROJECT_PRODUCTION_URL: 'production.example',
  ALLOWED_HOSTS: 'custom.example',
};

test('hosted config prefers secret JSON, initializes Sheets and Drive without local files', () => {
  const config = loadConfig(env);
  const adapter = new GoogleSheets(config);
  assert.deepEqual(adapter.api.context._options.auth.jsonContent, serviceAccount);
  const store = new PhotoStore(config);
  assert.equal(store.userAuth, true);
  assert.equal(store.oauthConnected, true);
  assert.equal(store.drive.context._options.auth.credentials.refresh_token, 'refresh');
  assert.deepEqual(config.allowedHosts, [
    'preview.example',
    'production.example',
    'custom.example',
  ]);
  assert.equal(config.maxUploadBytes, 4 * 1024 * 1024);
});

test('local config retains file fallback and hosted config rejects missing or malformed secrets safely', () => {
  const local = loadConfig({
    GOOGLE_SERVICE_ACCOUNT_FILE: './credentials/test.json',
    GOOGLE_DRIVE_OAUTH_FILE: './credentials/oauth.json',
  });
  assert.equal(local.serviceAccount, undefined);
  assert.match(local.keyFile, /credentials[\\/]test.json$/);
  assert.equal(local.driveOAuthFile, './credentials/oauth.json');
  for (const key of ['APP_PASSWORD', 'APP_SECRET', 'GOOGLE_SERVICE_ACCOUNT_JSON']) {
    assert.throws(() => loadConfig({ ...env, [key]: '' }), { code: 'APP_CONFIGURATION' });
  }
  for (const key of ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_DRIVE_OAUTH_JSON']) {
    assert.throws(
      () => loadConfig({ ...env, [key]: '{"private_key":"NEVER_PRINT_THIS"' }),
      (error) => {
        assert.match(error.message, new RegExp(key));
        assert.ok(!error.stack.includes('NEVER_PRINT_THIS'));
        return true;
      },
    );
  }
  assert.throws(() => loadConfig({ ...env, GOOGLE_SERVICE_ACCOUNT_JSON: 'null' }), {
    code: 'APP_CONFIGURATION',
  });
  assert.throws(() => loadConfig({ ...env, GOOGLE_SERVICE_ACCOUNT_JSON: '{}' }), {
    code: 'APP_CONFIGURATION',
  });
});

test('frontend handles platform text/HTML, malformed JSON and application failures without parsing crashes', async () => {
  for (const type of ['text/plain', 'text/html']) {
    await assert.rejects(
      readApiResponse(
        new Response('A server error has occurred', {
          status: 500,
          headers: { 'Content-Type': type },
        }),
      ),
      /HTTP 500/,
    );
  }
  await assert.rejects(
    readApiResponse(
      new Response('<html>not json</html>', { headers: { 'Content-Type': 'text/html' } }),
    ),
    /ผิดรูปแบบ/,
  );
  await assert.rejects(
    readApiResponse(new Response('{', { headers: { 'Content-Type': 'application/json' } })),
    /JSON ไม่สมบูรณ์/,
  );
  await assert.rejects(
    readApiResponse(Response.json({ error: 'ข้อมูลเปลี่ยนไป' }, { status: 409 })),
    /ข้อมูลเปลี่ยนไป.*409/,
  );
  await assert.rejects(readApiResponse(new Response('too large', { status: 413 })), /ไฟล์ใหญ่/);
  assert.deepEqual(await readApiResponse(Response.json({ authenticated: true })), {
    authenticated: true,
  });
});

test('Google diagnostics preserve status and frames without logging credentials or raw error bodies', (t) => {
  const captured = [];
  t.mock.method(console, 'error', (...args) => captured.push(args));
  const error = Object.assign(new Error('invalid_grant PRIVATE_KEY_DO_NOT_LOG'), {
    response: { status: 401, data: 'REFRESH_TOKEN_DO_NOT_LOG' },
    config: { headers: { Authorization: 'Bearer ACCESS_TOKEN_DO_NOT_LOG' } },
  });
  logError(error, 'Google');
  const output = JSON.stringify(captured);
  assert.ok(!output.includes('DO_NOT_LOG'));
  assert.match(output, /configuration.test.js/);
  assert.match(safeMessage(error), /credentials/);
});

test('local state expires values without any network access', async (t) => {
  const state = new StateStore();
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  await state.set('attempt:test', { count: 1 }, 1000);
  assert.deepEqual(await state.get('attempt:test'), { count: 1 });
  now += 1001;
  assert.equal(await state.get('attempt:test'), undefined);
});

test('Vercel entry imports without credentials and returns controlled JSON on startup errors', () => {
  const entry = new URL('../../api/index.js', import.meta.url).href;
  const script = `
    import app from ${JSON.stringify(entry)};
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/session');
      const body = await res.json();
      if (res.status !== 503 || !body.error || !res.headers.get('content-type').includes('application/json')) process.exitCode = 1;
      console.log('CONTROLLED_STARTUP_ERROR');
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      PATH: process.env.PATH,
      VERCEL: '1',
      DOTENV_CONFIG_PATH: '/tmp/iqi-nonexistent-test-env',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(output, /CONTROLLED_STARTUP_ERROR/);
});

test('local server still starts and serves frontend/auth with mocked Google setup and no cloud writes', () => {
  const runtime = new URL('../../backend/src/runtime.js', import.meta.url).href;
  const serverModule = new URL('../../backend/server.js', import.meta.url).href;
  const script = `
    import { adapter, app } from ${JSON.stringify(runtime)};
    adapter.initialize = async () => {};
    adapter.ensureSearchStatusColumn = async () => false;
    adapter.ensureReviewSheet = async () => false;
    adapter.read = async () => [{ sheet: 'IQI', headers: ['สถานะการค้นหา'], records: [] }];
    adapter.readReviewQueues = async () => ({ entries: [] });
    adapter.setReviewSelection = async () => { throw new Error('Cloud write must not run'); };
    let server;
    const listen = app.listen.bind(app);
    app.listen = (...args) => { server = listen(...args); return server; };
    await import(${JSON.stringify(serverModule)});
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      for (const path of ['/', '/js/app.js', '/styles/style.css', '/styles/dashboard.css', '/assets/fonts/thai.woff2', '/shared/core/formatters/labels.js', '/shared/features/photos/slots.js', '/js/features/dashboard/dashboard.js', '/api/auth/session']) {
        const response = await fetch(base + path);
        if (!response.ok) throw new Error('Local route failed: ' + path);
      }
      const session = await fetch(base + '/api/auth/session').then(res => res.json());
      const response = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-IQI-Request': session.csrf,
          'X-Forwarded-Proto': 'https', Origin: base.replace('http:', 'https:') },
        body: JSON.stringify({ password: 'local-test-password' }),
      });
      if (response.status !== 403) throw new Error('Local proxy spoof was trusted');
      console.log('LOCAL_STARTUP_OK');
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      PATH: process.env.PATH,
      PORT: '0',
      HOST: '127.0.0.1',
      APP_PASSWORD: 'local-test-password',
      DOTENV_CONFIG_PATH: '/tmp/iqi-nonexistent-test-env',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(output, /LOCAL_STARTUP_OK/);
});

test('configured Vercel entry serves auth and upload settings without external session storage', () => {
  const entry = new URL('../../api/index.js', import.meta.url).href;
  const script = `
    import app from ${JSON.stringify(entry)};
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      const sessionResponse = await fetch(base + '/api/auth/session');
      const session = await sessionResponse.json();
      if (sessionResponse.status !== 200 || session.authenticated !== false || !session.csrf) throw new Error('Auth initialization failed');
      const upload = await fetch(base + '/api/upload-config').then(res => res.json());
      if (upload.maxUploadBytes !== 4 * 1024 * 1024) throw new Error('Hosted upload limit missing');
      const unauthorized = await fetch(base + '/api/search?q=test');
      if (unauthorized.status !== 401) throw new Error('Authentication bypass');
      console.log('HOSTED_ENTRY_OK');
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 15000,
    env: { PATH: process.env.PATH, ...env, DOTENV_CONFIG_PATH: '/tmp/iqi-nonexistent-test-env' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(output, /HOSTED_ENTRY_OK/);
});
