import test from 'node:test';
import assert from 'node:assert/strict';
import { sendLoanConfirmation } from '../../backend/src/features/mail/loan-confirmation.js';
import { registerLoansRoutes } from '../../backend/src/features/loans/routes.js';

test('confirmation reads saved loan, sends only to session email and skips unchanged requests', async () => {
  const row = Array(19).fill('');
  Object.assign(row, {
    0: 'L-1',
    3: 'Alice',
    4: 'IQI',
    7: 'ASSET-1',
    9: 'Laptop',
    10: 'Meeting',
    11: '2026-11-05',
    12: '2026-11-07',
    14: 'รอดำเนินการ',
  });
  let reads = 0;
  const ledger = {
    readLedger: async () => {
      reads++;
      return { loans: [row] };
    },
  };
  const sent = [];
  const options = {
    env: {
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      MAIL_FROM: 'sender@example.com',
    },
    factory: (settings) => ({ send: async (message) => sent.push({ settings, message }) }),
  };
  assert.equal(
    await sendLoanConfirmation(ledger, { id: 'L-1' }, 'alice@example.com', options),
    'sent',
  );
  assert.deepEqual(sent[0].settings.to, ['alice@example.com']);
  for (const field of ['L-1', 'ASSET-1', 'Laptop', '2026-11-07', 'รอดำเนินการ'])
    assert.ok(sent[0].message.text.includes(field));
  await sendLoanConfirmation(ledger, { id: 'L-1', unchanged: true }, 'alice@example.com', options);
  assert.equal(sent.length, 1);
  assert.equal(reads, 1);
  assert.equal(
    await sendLoanConfirmation(ledger, { id: 'L-1' }, 'alice@example.com', {
      ...options,
      factory: () => ({
        send: async () => {
          throw Object.assign(Error('secret'), { code: 'EAUTH' });
        },
      }),
    }),
    'failed',
  );
  assert.equal(
    await sendLoanConfirmation(ledger, { id: 'missing' }, 'alice@example.com', options),
    'failed',
  );
  assert.equal(sent.length, 1);
});

test('loan endpoint confirms after saving, ignores payload email, and never confirms a rejected or repeated save', async () => {
  let handler;
  const calls = [];
  let result = { id: 'L-1' },
    saveError;
  registerLoansRoutes(
    {
      get() {},
      patch() {},
      post: (_path, fn) => {
        handler = fn;
      },
    },
    {
      lendingLedger: {},
      loanRequests: {
        submit: async (request) => {
          calls.push(['saved', request.email]);
          if (saveError) throw saveError;
          return { ...result };
        },
      },
      confirmLoan: async (_ledger, saved, email) => {
        calls.push(['confirmation', email, saved.id]);
        return 'failed';
      },
    },
  );
  const req = {
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    body: { requestId: 'request-1', email: 'attacker@example.com' },
  };
  let response, error;
  const res = {
    json: (value) => {
      response = value;
    },
  };
  const next = (value) => {
    error = value;
  };
  await handler(req, res, next);
  assert.deepEqual(calls, [
    ['saved', 'alice@example.com'],
    ['confirmation', 'alice@example.com', 'L-1'],
  ]);
  assert.deepEqual(response, { id: 'L-1', mailNotification: 'failed' });
  assert.equal(error, undefined);
  calls.length = 0;
  result = { id: 'L-1', unchanged: true };
  await handler(req, res, next);
  assert.equal(calls.length, 1);
  calls.length = 0;
  saveError = new Error('Save failed');
  await handler(req, res, next);
  assert.equal(calls.length, 1);
  assert.equal(error, saveError);
});
