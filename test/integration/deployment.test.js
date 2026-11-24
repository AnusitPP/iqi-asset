import { request as httpRequest } from 'node:http';
import { testSession } from '../helpers/session.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { StateStore, writeLocked } from '../../backend/src/core/state/stateStore.js';
import { runtimeReadiness } from '../../backend/src/readiness.js';
import { driveOAuth } from '../../backend/src/integrations/google/driveAuth.js';

test('Google sessions and revocation work across instances with shared storage', async (t) => {
  const fixture = await testSession({
    hosted: true,
    host: '127.0.0.1',
    appSecret: 'a'.repeat(64),
    sheets: ['IQI', 'items', 'all'],
  });
  const servers = [0, 1].map(() =>
    createApp({ adapter: { initialize: async () => {} } }, fixture.config).listen(0, '127.0.0.1'),
  );
  await Promise.all(
    servers.map((server) => new Promise((resolve) => server.once('listening', resolve))),
  );
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });
  const request = (index, path, options = {}) =>
    fetch('http://127.0.0.1:' + servers[index].address().port + path, options);
  const session = await request(0, '/api/auth/session').then((res) => res.json());
  const other = await request(1, '/api/auth/session').then((res) => res.json());
  assert.equal(session.csrf, other.csrf);
  const headers = { Cookie: fixture.cookie, 'X-IQI-Request': session.csrf };
  for (const instance of [0, 1])
    assert.equal((await request(instance, '/api/status', { headers })).status, 200);
  const untrusted = await new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port: servers[0].address().port,
        path: '/api/status',
        headers: { ...headers, Host: 'untrusted.example' },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(untrusted, 403);
  assert.equal((await request(0, '/api/auth/logout', { method: 'POST', headers })).status, 200);
  for (const instance of [0, 1])
    assert.equal((await request(instance, '/api/status', { headers })).status, 401);
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

test('runtime shares lending readiness and retries failed initialization without reading retired sheets', async () => {
  let calls = 0;
  const adapter = {
    initialize: async () => {
      if (++calls === 1) throw new Error('temporary');
    },
    read: async () => {
      throw new Error('Retired sheets must not be read');
    },
  };
  const ready = runtimeReadiness(adapter);
  await assert.rejects(ready(), /temporary/);
  await Promise.all([ready(), ready()]);
  await ready();
  assert.equal(calls, 2);
});

test('Drive OAuth accepts secret JSON without filesystem credentials', () => {
  const connection = driveOAuth({
    installed: { client_id: 'client', client_secret: 'secret' },
    refresh_token: 'refresh',
  });
  assert.equal(connection.connected, true);
  assert.equal(connection.auth.credentials.refresh_token, 'refresh');
});
