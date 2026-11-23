import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { request as httpRequest } from 'node:http';
import {
  devActivityEnabled,
  registerDevActivity,
  sendDevActivity,
} from '../../backend/src/features/notifications/dev-activity.js';

const config = {
  devChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/dev/messages?key=test&token=test',
};

test('Dev notifications require an explicit webhook and are disabled on production', () => {
  assert.equal(devActivityEnabled(config, {}), true);
  assert.equal(devActivityEnabled({}, {}), false);
  assert.equal(devActivityEnabled({ ...config, hosted: true }, {}), false);
  assert.equal(devActivityEnabled(config, { VERCEL: '1' }), false);
});

test('successful localhost mutations notify once, while reads, previews, failures and retries do not', async (t) => {
  const events = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'u1', name: 'Tester' };
    next();
  });
  registerDevActivity(app, config, {
    env: {},
    notify: async (event) => {
      events.push(event);
    },
  });
  app.patch('/api/approval-requests/:id', (req, res) =>
    res.status(req.body.reject ? 409 : 200).json({ id: req.params.id }),
  );
  app.post('/api/loans', (req, res) => res.json({ id: 'L-1', unchanged: req.body.unchanged }));
  app.post('/api/loan-catalog/preview', (_req, res) =>
    res.json({ preview: 'data:image/jpeg;base64,secret' }),
  );
  app.get('/api/approval-requests', (_req, res) => res.json({ records: [] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, method, body, host) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(host ? { Host: host } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  assert.equal(
    (
      await send('/api/approval-requests/L-1', 'PATCH', {
        status: 'กำลังยืม',
        password: 'secret',
        email: 'private@example.com',
        photos: ['binary-secret'],
      })
    ).status,
    200,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'ปรับสถานะคำขอ');
  assert.deepEqual(events[0].fields, [['สถานะใหม่', 'กำลังยืม']]);
  assert.ok(!JSON.stringify(events).includes('secret'));
  await send('/api/approval-requests', 'GET');
  await send('/api/loan-catalog/preview', 'POST', {});
  await send('/api/approval-requests/L-1', 'PATCH', { reject: true });
  await send('/api/loans', 'POST', { unchanged: true });
  await new Promise((resolve, reject) => {
    const req = httpRequest(
      base + '/api/loans',
      { method: 'POST', headers: { Host: 'example.com', 'Content-Type': 'application/json' } },
      (res) => {
        res.resume();
        res.on('end', resolve);
      },
    );
    req.on('error', reject);
    req.end('{}');
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  await send('/api/loans', 'POST', {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 2);
});

test('compact Dev card escapes values and uses only its dedicated webhook', async () => {
  let sent;
  const result = await sendDevActivity(
    {
      action: 'เพิ่มครุภัณฑ์',
      actor: '<Admin>',
      id: 'A1',
      fields: [['อุปกรณ์', 'Laptop & Mouse']],
      method: 'POST',
      path: '/api/loan-catalog',
      time: '20/11/2026',
    },
    {
      env: {
        GOOGLE_CHAT_DEV_WEBHOOK_URL: config.devChatWebhookUrl,
        GOOGLE_CHAT_WEBHOOK_URL: 'https://example.com/production',
      },
      fetcher: async (url, options) => {
        sent = { url, ...options };
        return { ok: true };
      },
    },
  );
  assert.equal(result, 'sent');
  assert.equal(sent.url, config.devChatWebhookUrl);
  const payload = JSON.parse(sent.body);
  assert.deepEqual(Object.keys(payload), ['cardsV2']);
  assert.ok(sent.body.includes('&lt;Admin&gt;'));
  assert.ok(sent.body.includes('Laptop &amp; Mouse'));
  assert.ok(!sent.body.includes('example.com/production'));
  assert.ok(sent.signal instanceof AbortSignal);
});
