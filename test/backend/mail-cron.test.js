import test from 'node:test';
import assert from 'node:assert/strict';
import { registerMailCron } from '../../backend/src/features/mail/cron.js';
import { runDueReminders } from '../../backend/src/features/mail/reminder-job.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';

const response = () => ({
  statusCode: 200,
  set() {
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.data = data;
    return this;
  },
});
const request = (authorization = '') => ({ get: () => authorization });

test('cron fails closed without secret, checks bearer token before running and returns only counts', async () => {
  let handler,
    calls = 0;
  const env = {};
  registerMailCron(
    {
      get: (_path, fn) => {
        handler = fn;
      },
    },
    {
      env,
      run: async () => {
        calls++;
        return { sent: 2, failed: 0 };
      },
    },
  );
  const missing = response();
  await handler(request(), missing);
  assert.equal(missing.statusCode, 503);
  env.CRON_SECRET = 'secret';
  for (const token of ['', 'Bearer wrong', 'Basic secret']) {
    const res = response();
    await handler(request(token), res);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(calls, 0);
  const res = response();
  await handler(request('Bearer secret'), res);
  assert.deepEqual(res.data, { sent: 2, failed: 0 });
  assert.equal(calls, 1);
});

test('cron rejects overlapping calls in one instance and surfaces partial failure counts', async () => {
  let handler, release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  registerMailCron(
    {
      get: (_path, fn) => {
        handler = fn;
      },
    },
    {
      env: { CRON_SECRET: 'secret' },
      run: async () => {
        await wait;
        return { sent: 1, failed: 1 };
      },
    },
  );
  const first = response();
  const running = handler(request('Bearer secret'), first);
  const overlap = response();
  await handler(request('Bearer secret'), overlap);
  assert.equal(overlap.statusCode, 409);
  release();
  await running;
  assert.equal(first.statusCode, 502);
  assert.deepEqual(first.data, { sent: 1, failed: 1 });
});

test('cron runner reads live rows, sends only two-day reminders and isolates each recipient', async () => {
  const headers = [...LOAN_HEADERS.slice(0, 4), 'email', ...LOAN_HEADERS.slice(4)];
  const row = (id, email, due) => {
    const values = Array(19).fill('');
    Object.assign(values, { 0: id, 1: id, 3: id, 7: `ASSET-${id}`, 12: due });
    return [...values.slice(0, 4), email, ...values.slice(4)];
  };
  const loans = [
    headers,
    row('A', 'a@example.com', '2026-11-7'),
    row('B', 'b@example.com', '2026-11-07'),
    row('TOMORROW', 'c@example.com', '2026-11-6'),
  ];
  const adapter = {
    config: { spreadsheetId: 'fixture' },
    readLoanSheets: async () => ({ loans, returns: [RETURN_HEADERS] }),
    api: { spreadsheets: { values: { get: async () => ({ data: { values: loans } }) } } },
  };
  const sent = [];
  const result = await runDueReminders(adapter, {
    now: new Date('2026-11-05T01:00:00Z'),
    env: {
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      MAIL_FROM: 'sender@example.com',
    },
    factory: (settings) => ({ send: async (message) => sent.push({ settings, message }) }),
  });
  assert.deepEqual(result, {
    recipients: 2,
    missingEmails: 0,
    invalidDates: 0,
    sent: 2,
    failed: 0,
  });
  assert.deepEqual(
    sent.map((mail) => mail.settings.to),
    [['a@example.com'], ['b@example.com']],
  );
  assert.doesNotMatch(sent[0].message.text, /ASSET-B|TOMORROW/);
  assert.doesNotMatch(sent[1].message.text, /ASSET-A|TOMORROW/);
});
