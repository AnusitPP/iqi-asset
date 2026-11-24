import { testSession } from '../helpers/session.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';

test('removed inspection APIs stay unavailable and never access their data', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1', sheets: ['IQI', 'items', 'all'] });
  const adapter = {
    initialize: async () => {},
    read: async () => {
      throw new Error('Removed feature read');
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Cookie: fixture.cookie,
    'X-IQI-Request': fixture.csrf,
    'Content-Type': 'application/json',
  };
  const status = await fetch(`${base}/api/status`, { headers }).then((res) => res.json());
  headers['X-IQI-Request'] = status.csrf;
  for (const path of [
    '/api/search?q=asset',
    '/api/record?sheet=IQI&row=2',
    '/api/review-inspection',
    '/api/dashboard',
  ])
    assert.equal((await fetch(base + path, { headers })).status, 404, path);
  for (const path of [
    '/api/iqi/2',
    '/api/iqi/2/search-status',
    '/api/review-selection',
    '/api/review-inspection',
    '/api/dashboard/2/status',
  ])
    assert.equal(
      (await fetch(base + path, { method: 'PUT', headers, body: '{}' })).status,
      404,
      path,
    );
  for (const path of ['/credentials/service-account.json', '/.env', '/package.json'])
    assert.equal((await fetch(base + path)).status, 404);
});
