import test from 'node:test';
import assert from 'node:assert/strict';
import { sendRequestNotification } from '../../backend/src/features/notifications/google-chat.js';
import { registerLoansRoutes } from '../../backend/src/features/loans/routes.js';
import { registerReturnsRoutes } from '../../backend/src/features/returns/routes.js';

const env = {
  GOOGLE_CHAT_WEBHOOK_URL:
    'https://chat.googleapis.com/v1/spaces/test/messages?key=test-key&token=test-token',
};
const loan = [
  'L-1',
  '',
  '',
  'Alice',
  'IQI',
  '',
  'Computer',
  'A1',
  'S1',
  'Laptop',
  '',
  '2026-11-20',
  '2026-11-21',
];
const returning = [
  'R-1',
  'L-1',
  '',
  '',
  'Alice',
  'IQI',
  '',
  'Computer',
  'A1',
  'S1',
  'Laptop',
  '2026-11-21',
];
const ledger = { readLedger: async () => ({ loans: [loan], returns: [returning] }) };

test('loan and return status changes never send Chat notifications', async () => {
  let handler;
  const savedLoan = [...loan];
  const savedReturn = [...returning];
  savedLoan[1] = 'loan-item-1';
  savedReturn[2] = 'return-item-2';
  savedLoan[14] = savedReturn[14] = 'รอดำเนินการ';
  const statusLedger = {
    withWriteLock: (work) => work(),
    readLedger: async () => ({ loans: [savedLoan], returns: [savedReturn] }),
    adapter: { updateLoanStatus: async () => {}, updateReturnStatus: async () => {} },
  };
  registerLoansRoutes({ get() {}, post() {}, patch(_path, fn) { handler = fn; } }, {
    lendingLedger: statusLedger,
    notifyStatus: async () => 'sent',
    notifyRequest: () => assert.fail('Status changes must not notify Chat'),
  });
  for (const [kind, id] of [['ยืม', 'L-1'], ['คืน', 'R-1']]) {
    let response;
    await handler({
      user: { role: 'ADMIN', name: 'Admin' },
      params: { id },
      body: { kind, status: kind === 'คืน' ? 'เสร็จสิ้น' : 'ยกเลิก', condition: 'ดี' },
      authStorage: { write: async () => {} },
    }, { json(value) { response = value; } }, (error) => { throw error; });
    assert.equal(response.id, id);
  }
});

test('Chat sends saved loan and return details with a bounded request', async () => {
  const sent = [];
  const options = {
    env,
    fetcher: async (url, request) => {
      sent.push({ url, ...request });
      return { ok: true };
    },
  };
  assert.equal(await sendRequestNotification(ledger, 'ยืม', { id: 'L-1' }, options), 'sent');
  assert.equal(await sendRequestNotification(ledger, 'คืน', { id: 'R-1' }, options), 'sent');
  for (const request of sent) {
    assert.equal(request.url, env.GOOGLE_CHAT_WEBHOOK_URL);
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.ok(request.signal instanceof AbortSignal);
    const { text } = JSON.parse(request.body);
    for (const field of ['Alice', 'IQI', 'Laptop', 'A1', 'S1']) assert.ok(text.includes(field));
    assert.ok(!text.includes('test-token'));
  }
  assert.match(JSON.parse(sent[0].body).text, /มีคำขอยืมใหม่/);
  assert.match(JSON.parse(sent[0].body).text, /กำหนดคืน: 2026-11-21/);
  assert.match(JSON.parse(sent[1].body).text, /มีคำขอคืนใหม่/);
  assert.match(JSON.parse(sent[1].body).text, /วันที่คืน: 2026-11-21/);
});

test('disabled and duplicate notifications do no IO; invalid URLs and delivery errors fail safely', async () => {
  const noIO = () => assert.fail('Unexpected IO');
  assert.equal(
    await sendRequestNotification(
      { readLedger: noIO },
      'ยืม',
      { id: 'L-1' },
      { env: {}, fetcher: noIO },
    ),
    'skipped',
  );
  assert.equal(
    await sendRequestNotification(
      { readLedger: noIO },
      'ยืม',
      { id: 'L-1', unchanged: true },
      { env, fetcher: noIO },
    ),
    'skipped',
  );
  let reports = 0;
  const report = (...args) => {
    assert.equal(args.length, 0);
    reports++;
  };
  for (const webhook of [
    'http://localhost/messages',
    'https://example.com/v1/spaces/test/messages?key=k&token=t',
  ]) {
    assert.equal(
      await sendRequestNotification(
        { readLedger: noIO },
        'ยืม',
        { id: 'L-1' },
        {
          env: { GOOGLE_CHAT_WEBHOOK_URL: webhook },
          fetcher: noIO,
          report,
        },
      ),
      'failed',
    );
  }
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => {
      throw new Error(env.GOOGLE_CHAT_WEBHOOK_URL);
    },
  ]) {
    assert.equal(
      await sendRequestNotification(ledger, 'ยืม', { id: 'L-1' }, { env, fetcher, report }),
      'failed',
    );
  }
  assert.equal(
    await sendRequestNotification(ledger, 'ยืม', { id: 'missing' }, { env, fetcher: noIO, report }),
    'failed',
  );
  assert.equal(reports, 5);
});

for (const [kind, register, service] of [
  ['ยืม', registerLoansRoutes, 'loanRequests'],
  ['คืน', registerReturnsRoutes, 'returnRequests'],
]) {
  test(`${kind} endpoint notifies only a successful new submission and tolerates Chat failure`, async () => {
    let handler;
    let unchanged = false;
    let rejected = false;
    const calls = [];
    register(
      {
        get() {},
        patch() {},
        post(_path, fn) {
          handler = fn;
        },
      },
      {
        lendingLedger: ledger,
        [service]: {
          submit: async () => {
            calls.push('save');
            if (rejected) throw new Error('Invalid request');
            return { id: 'request-1', ...(unchanged ? { unchanged: true } : {}) };
          },
        },
        notifyRequest: async (savedLedger, savedKind, result) => {
          assert.equal(savedLedger, ledger);
          assert.equal(savedKind, kind);
          assert.equal(result.id, 'request-1');
          calls.push('notify');
          return 'failed';
        },
      },
    );
    const req = { body: {} };
    const res = { json: () => calls.push('response') };
    const next = () => calls.push('error');
    await handler(req, res, next);
    assert.deepEqual(calls.splice(0), ['save', 'notify', 'response']);
    unchanged = true;
    await handler(req, res, next);
    assert.deepEqual(calls.splice(0), ['save', 'response']);
    rejected = true;
    await handler(req, res, next);
    assert.deepEqual(calls, ['save', 'error']);
  });
}
