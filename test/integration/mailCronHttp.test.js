import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';

test('Vercel cron uses bearer auth without browser cookies or CSRF and cannot bypass auth on other APIs', async (t) => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });
  let reads = 0;
  const adapter = {
    config: { spreadsheetId: 'fixture' },
    readLoanSheets: async () => {
      reads++;
      return { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
    },
    api: {
      spreadsheets: {
        values: {
          get: async () => {
            reads++;
            return { data: { values: [['เลขรายการยืม', 'email']] } };
          },
        },
      },
    },
  };
  const server = createApp({ adapter }, { host: '127.0.0.1' }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/cron/due-reminders')).status, 401);
  assert.equal(reads, 0);
  const headers = { Authorization: 'Bearer cron-test-secret' };
  const res = await fetch(base + '/api/cron/due-reminders', { headers });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    recipients: 0,
    missingEmails: 0,
    invalidDates: 0,
    sent: 0,
    failed: 0,
  });
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.equal((await fetch(base + '/api/loans', { headers })).status, 401);
});
