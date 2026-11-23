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
  registerLoansRoutes(
    {
      get() {},
      post() {},
      patch(_path, fn) {
        handler = fn;
      },
    },
    {
      lendingLedger: statusLedger,
      notifyStatus: async () => 'sent',
      notifyRequest: () => assert.fail('Status changes must not notify Chat'),
    },
  );
  for (const [kind, id] of [
    ['ยืม', 'L-1'],
    ['คืน', 'R-1'],
  ]) {
    let response;
    await handler(
      {
        user: { role: 'ADMIN', name: 'Admin' },
        params: { id },
        body: { kind, status: kind === 'คืน' ? 'เสร็จสิ้น' : 'ยกเลิก', condition: 'ดี' },
        authStorage: { write: async () => {} },
      },
      {
        json(value) {
          response = value;
        },
      },
      (error) => {
        throw error;
      },
    );
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
    const message = JSON.parse(request.body);
    assert.deepEqual(Object.keys(message), ['cardsV2']);
    assert.equal(message.cardsV2.length, 1);
    for (const field of ['Alice', 'IQI', 'Laptop', 'A1', 'S1'])
      assert.ok(request.body.includes(field));
    assert.ok(!request.body.includes('test-token'));
  }
  assert.match(sent[0].body, /มีคำขอยืมใหม่/);
  assert.match(sent[0].body, /กำหนดคืน:<\/b> 2026-11-21/);
  assert.match(sent[1].body, /มีคำขอคืนใหม่/);
  assert.match(sent[1].body, /วันที่คืน:<\/b> 2026-11-21/);
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

test('cards group saved details, escape HTML, and link to approval requests', async () => {
  const savedLoan = [...loan];
  savedLoan[1] = 'item-1';
  savedLoan[3] = 'Alice <b>Admin</b>';
  savedLoan[10] = 'Meeting & training\nProject <test>';
  savedLoan[13] = 'Bring charger';
  const savedReturn = [...returning];
  savedReturn[2] = 'item-1';
  savedReturn[12] = 'Returned with charger';
  const saved = { readLedger: async () => ({ loans: [savedLoan], returns: [savedReturn] }) };
  for (const [kind, id] of [
    ['ยืม', 'L-1'],
    ['คืน', 'R-1'],
  ]) {
    let message;
    assert.equal(
      await sendRequestNotification(
        saved,
        kind,
        { id },
        {
          env: { ...env, FRONTEND_URL: 'https://assets.example.com' },
          fetcher: async (_url, request) => {
            message = JSON.parse(request.body);
            return { ok: true };
          },
        },
      ),
      'sent',
    );
    const card = message.cardsV2[0].card;
    assert.equal(card.header.title, `🔔 มีคำขอ${kind}ใหม่`);
    assert.equal(
      card.header.subtitle,
      kind === 'คืน'
        ? 'ส่วนที่ 5 : คืนครุภัณฑ์คอมพิวเตอร์ หรือคืนวัสดุด้านเทคโนโลยีสารสนเทศ'
        : 'ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ',
    );
    assert.equal(card.sections.length, 3);
    const details = card.sections[1].widgets[0].textParagraph.text;
    assert.ok(
      details.includes(
        '• <b>เหตุผล / วัตถุประสงค์:</b> Meeting &amp; training<br>Project &lt;test&gt;',
      ),
    );
    assert.ok(
      details.includes(
        `• <b>หมายเหตุ:</b> ${kind === 'คืน' ? 'Returned with charger' : 'Bring charger'}`,
      ),
    );
    assert.equal(card.sectionDividerStyle, 'SOLID_DIVIDER');
    assert.equal(card.sections[2].widgets[0].buttonList.buttons[0].type, 'OUTLINED');
    assert.equal(
      card.sections[2].widgets[0].buttonList.buttons[0].onClick.openLink.url,
      'https://assets.example.com/approval-requests',
    );
    assert.ok(!JSON.stringify(card).includes('<b>Admin</b>'));
  }
});

test('optional catalog photo respects public preview setting and lookup failure', async () => {
  let message;
  let reads = 0;
  const saved = {
    ...ledger,
    adapter: {
      readReadyToBorrow: async () => {
        reads++;
        return [
          ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์', 'รูป (ลิงก์)'],
          [
            'A1',
            'S1',
            'Laptop',
            'https://drive.google.com/file/d/public-photo/view\nhttps://drive.google.com/file/d/second-photo/view',
          ],
        ];
      },
    },
  };
  const options = {
    env,
    fetcher: async (_url, request) => {
      message = JSON.parse(request.body);
      return { ok: true };
    },
  };
  await sendRequestNotification(saved, 'ยืม', { id: 'L-1' }, options);
  assert.equal(reads, 0);
  assert.equal(message.cardsV2[0].card.sections[0].widgets[0].columns, undefined);
  options.env = { ...env, PUBLIC_PHOTO_PREVIEW: 'true' };
  await sendRequestNotification(saved, 'ยืม', { id: 'L-1' }, options);
  const columns = message.cardsV2[0].card.sections[0].widgets[0].columns;
  assert.equal(message.cardsV2[0].card.header.imageType, 'SQUARE');
  assert.equal(
    columns.columnItems[1].widgets[0].image.imageUrl,
    'http://localhost:3000/api/chat-photos/public-photo',
  );
  saved.adapter.readReadyToBorrow = async () => {
    throw new Error('Catalog unavailable');
  };
  assert.equal(await sendRequestNotification(saved, 'ยืม', { id: 'L-1' }, options), 'sent');
  assert.equal(message.cardsV2[0].card.sections[0].widgets[0].columns, undefined);
});

test('Chat uses the configured website and supplied laptop icon without exposing private images', async () => {
  let message;
  const adapter = {
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์', 'รูป (ลิงก์)'],
      ['A1', 'S1', 'Laptop', 'https://drive.google.com/file/d/private-photo/view'],
    ],
  };
  const options = {
    env: { ...env, GOOGLE_CHAT_APP_URL: 'https://iqi-asset.vercel.app/' },
    photoStore: { isPublic: async () => false },
    fetcher: async (_url, request) => {
      message = JSON.parse(request.body);
      return { ok: true };
    },
  };
  await sendRequestNotification({ ...ledger, adapter }, 'ยืม', { id: 'L-1' }, options);
  const card = message.cardsV2[0].card;
  assert.equal(
    card.header.imageUrl,
    'https://iqi-asset.vercel.app/assets/images/laptop-webhook-icon.png',
  );
  assert.equal(
    card.sections[2].widgets[0].buttonList.buttons[0].onClick.openLink.url,
    'https://iqi-asset.vercel.app/approval-requests',
  );
  assert.equal(card.sections[0].widgets[0].columns, undefined);
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
