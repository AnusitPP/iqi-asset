import test from 'node:test';
import assert from 'node:assert/strict';
import { registerMailRoutes } from '../../backend/src/features/mail/routes.js';

test('manual mail separates configuration, Sheets and SMTP errors without exposing secrets', async () => {
  for (const stage of ['settings', 'sheets', 'smtp']) {
    let handler;
    registerMailRoutes(
      {
        post: (_path, fn) => {
          handler = fn;
        },
      },
      {
        env: {
          SMTP_HOST: 'smtp.example.com',
          SMTP_USER: 'user',
          SMTP_PASS: stage === 'settings' ? '' : 'secret',
          MAIL_FROM: 'sender@example.com',
        },
        lendingLedger: {
          readLedger: async () => {
            if (stage === 'sheets') throw Error('secret sheet details');
            return { loans: [], returns: [], active: [] };
          },
        },
        factory: () => ({
          send: async () => {
            throw Object.assign(Error('secret SMTP response'), { code: 'EAUTH' });
          },
        }),
      },
    );
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
      },
    };
    await handler(
      {
        user: { permissions: ['ADMIN_DASHBOARD_VIEW'] },
        body: { email: 'recipient@example.com', type: 'summary' },
      },
      response,
    );
    assert.equal(response.statusCode, 502);
    assert.equal(response.data.stage, stage);
    assert.doesNotMatch(response.data.error, /secret/);
    if (stage === 'smtp') assert.match(response.data.error, /ล็อกอินไม่ผ่าน/);
    if (stage === 'settings') assert.match(response.data.error, /SMTP_PASS/);
  }
});

test('manual mail enforces permissions and validates one recipient before reading data', async () => {
  let handler;
  let reads = 0;
  const sent = [];
  const env = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'sender@example.com',
    SMTP_PASS: 'secret',
    MAIL_FROM: 'sender@example.com',
  };
  registerMailRoutes(
    {
      post: (_path, fn) => {
        handler = fn;
      },
    },
    {
      env,
      lendingLedger: {
        readLedger: async () => {
          reads++;
          return { loans: [], returns: [], active: [] };
        },
      },
      factory: (settings) => ({ send: async (message) => sent.push({ settings, message }) }),
    },
  );
  const invoke = async (user, body) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await handler({ user, body }, response);
    return response;
  };
  const admin = { permissions: ['ADMIN_DASHBOARD_VIEW'] };
  assert.equal((await invoke(null, {})).statusCode, 401);
  assert.equal((await invoke({ permissions: ['LOAN_CREATE'] }, {})).statusCode, 403);
  for (const body of [
    { email: 'a@example.com,b@example.com', type: 'loan' },
    { email: 'a@example.com\r\nBcc:x@example.com', type: 'loan' },
    { email: 'a@example.com', type: 'unknown' },
  ])
    assert.equal((await invoke(admin, body)).statusCode, 400);
  assert.equal(reads, 0);
  for (const type of ['loan', 'return', 'summary']) {
    const response = await invoke(admin, { email: ' chosen@example.com ', type });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(sent.at(-1).settings.to, ['chosen@example.com']);
    if (type === 'loan') assert.doesNotMatch(sent.at(-1).message.text, /รายการรอรับคืน/);
    if (type === 'return')
      assert.doesNotMatch(sent.at(-1).message.text, /คำขอยืมรอดำเนินการ|รายการยืมเกินกำหนด/);
  }
});
