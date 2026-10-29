import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { StateStore, writeLocked } from '../../backend/src/core/state/stateStore.js';
import { Records } from '../../backend/src/features/records/service.js';
import { parseSheet } from '../../backend/src/features/records/search.js';
import { signToken } from '../../backend/src/core/security/tokens.js';
import { runtimeReadiness } from '../../backend/src/readiness.js';
import {
  REVIEW_HEADERS,
  REVIEW_DATE_HEADER,
  INSPECTION_HEADER,
} from '../../backend/src/features/review/queue.js';
import { driveOAuth } from '../../backend/src/integrations/google/driveAuth.js';
import {
  resizeForUpload,
  setUploadLimit,
} from '../../frontend/public/js/features/photos/prepareUpload.js';

test('signed sessions work across instances while rate limits and revocations remain local', async (t) => {
  const states = [new StateStore(), new StateStore()];
  const config = {
    hosted: true,
    host: '0.0.0.0',
    allowedHosts: ['app.example'],
    appSecret: 'a'.repeat(64),
    password: 'secret',
    sheets: ['IQI', 'items', 'all'],
  };
  const servers = states.map((state) =>
    createApp({ adapter: { initialize: async () => {} } }, { ...config, state }).listen(
      0,
      '127.0.0.1',
    ),
  );
  await Promise.all(
    servers.map((server) => new Promise((resolve) => server.once('listening', resolve))),
  );
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });
  const request = (instance, path, options = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: '127.0.0.1',
          port: servers[instance].address().port,
          path,
          method: options.method || 'GET',
          headers: {
            Host: 'app.example',
            'X-Forwarded-Proto': 'https',
            Origin: 'https://app.example',
            ...options.headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode,
                headers: res.headers,
              }),
            ),
          );
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });
  const sessions = await Promise.all(
    [0, 1].map((instance) => request(instance, '/api/auth/session').then((res) => res.json())),
  );
  assert.equal(sessions[0].csrf, sessions[1].csrf);
  const headers = { 'X-IQI-Request': sessions[0].csrf, 'Content-Type': 'application/json' };
  const login = (instance, password) =>
    request(instance, '/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ password }),
    });
  const loggedIn = await login(1, 'secret');
  assert.equal(loggedIn.status, 200);
  assert.match(loggedIn.headers.get('set-cookie'), /Secure/);
  headers.Cookie = loggedIn.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(0, '/api/status', { headers })).status, 200);
  assert.equal(
    (await request(0, '/api/status', { headers: { ...headers, Host: 'untrusted.example' } }))
      .status,
    403,
  );
  assert.equal((await request(0, '/api/auth/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await request(0, '/api/status', { headers })).status, 401);
  // A copied cookie is not globally revoked without shared storage.
  assert.equal((await request(1, '/api/status', { headers })).status, 200);
  assert.equal((await request(1, '/api/status')).status, 401);
  const copied = headers.Cookie;
  headers.Cookie = copied.slice(0, -1) + (copied.endsWith('A') ? 'B' : 'A');
  assert.equal((await request(1, '/api/status', { headers })).status, 401);
  headers.Cookie = copied;
  for (let i = 0; i < 5; i++) assert.equal((await login(0, 'wrong')).status, 401);
  assert.equal((await login(0, 'secret')).status, 429);
  assert.equal((await login(1, 'secret')).status, 200);
});

test('signed revisions save across instances and reject tampering, expiry and stale rows', async () => {
  const rows = [
    ['เลขครุภัณฑ์', 'หมายเหตุ'],
    ['asset-1', 'original'],
  ];
  const config = { sheets: ['IQI'], appSecret: 's'.repeat(64) };
  const states = [new StateStore(), new StateStore()];
  const adapters = states.map((state) => ({
    state,
    config: { ...config, spreadsheetId: 'test' },
    read: async () => [parseSheet('IQI', structuredClone(rows))],
    writeIQI: async (row, changes) => {
      for (const change of changes) rows[row - 1][change.index] = change.value;
    },
  }));
  const [first, second] = adapters.map((adapter) => new Records(adapter, config));
  const record = await first.detail('IQI', 2);
  const values = ['asset-1', 'saved from another instance'];
  await assert.rejects(second.save(2, { revision: `${record.revision}x`, values }), {
    status: 409,
  });
  const [table] = await adapters[0].read();
  const expired = signToken({ sheet: 'IQI', row: 2, expires: Date.now() - 1 }, config.appSecret);
  await assert.rejects(second.save(2, { revision: expired, values }), { status: 409 });
  const saved = await second.save(2, { revision: record.revision, values });
  assert.deepEqual(saved.values, values);
  await assert.rejects(first.save(2, { revision: record.revision, values: record.values }), {
    status: 409,
  });
  assert.equal(table.sheet, 'IQI');
});

test('local write lock serializes work in one instance and releases after failure', async () => {
  const state = new StateStore();
  const adapters = [0, 1].map(() => ({ state, config: { spreadsheetId: 'same-sheet' } }));
  const order = [];
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const first = writeLocked(adapters[0], async () => {
    order.push('first');
    entered();
    await gate;
    order.push('finished');
  });
  await started;
  const second = writeLocked(adapters[1], async () => {
    order.push('second');
  });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first', 'finished', 'second']);
  await assert.rejects(
    writeLocked(adapters[0], async () => {
      throw new Error('write failed');
    }),
    /write failed/,
  );
  await writeLocked(adapters[1], async () => order.push('recovered'));
  assert.equal(order.at(-1), 'recovered');
});

test('runtime loads review metadata without migrations, shares readiness and retries failed initialization', async () => {
  let calls = 0;
  const queues = ['รอตรวจสอบ', 'IQI + IT'].map((sheet) => ({
    sheet,
    values: async () => [[...REVIEW_HEADERS, REVIEW_DATE_HEADER, INSPECTION_HEADER]],
    validate: () => {},
  }));
  const adapter = {
    config: { sheets: ['IQI'], spreadsheetId: 'test' },
    initialize: async () => {
      if (++calls === 1) throw new Error('temporary');
    },
    api: {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: queues.map((queue, sheetId) => ({
              properties: { title: queue.sheet, sheetId },
            })),
          },
        }),
      },
    },
    read: async () => [{ headers: ['เลขครุภัณฑ์', 'สถานะการค้นหา'] }],
    reviewQueue: queues[0],
    iqiItQueue: queues[1],
  };
  const ready = runtimeReadiness(adapter);
  await assert.rejects(ready(), /temporary/);
  await Promise.all([ready(), ready()]);
  assert.equal(calls, 2);
  assert.equal(queues[0].properties.sheetId, 0);
  assert.equal(queues[1].properties.sheetId, 1);
  adapter.read = async () => [{ headers: ['เลขครุภัณฑ์'] }];
  await assert.rejects(runtimeReadiness(adapter)(), { status: 422 });
});

test('Drive OAuth accepts secret JSON without filesystem credentials', () => {
  const connection = driveOAuth({
    installed: { client_id: 'client', client_secret: 'secret' },
    refresh_token: 'refresh',
  });
  assert.equal(connection.connected, true);
  assert.equal(connection.auth.credentials.refresh_token, 'refresh');
});

test('oversized HEIC is rejected before uploading on hosted deployments', async () => {
  setUploadLimit(4 * 1024 * 1024);
  try {
    await assert.rejects(
      resizeForUpload({ name: 'photo.heic', type: 'image/heic', size: 5 * 1024 * 1024 }),
      /4 MB/,
    );
    const small = { name: 'photo.heic', type: 'image/heic', size: 1024 };
    assert.equal(await resizeForUpload(small), small);
  } finally {
    setUploadLimit(25 * 1024 * 1024);
  }
});
