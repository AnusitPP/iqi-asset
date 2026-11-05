import { LENDING_STATUS } from '../../shared/features/lending/status.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySummary } from '../../backend/src/features/mail/daily-summary.js';
import { mailSettings, createMailer } from '../../backend/src/features/mail/mailer.js';
const loan = (id, due, status = 'รอดำเนินการ') => {
  const row = [];
  Object.assign(row, { 0: id, 3: 'ผู้ยืม', 7: 'ASSET', 9: 'Laptop', 12: due, 14: status });
  return row;
};
test('daily summary uses Bangkok date, includes only overdue active loans and pending returns', () => {
  const old = loan('OVERDUE', '04/11/2569');
  const today = loan('TODAY', '2026-11-05');
  const returned = loan('RETURNED', '2026-11-01', LENDING_STATUS.RETURNED);
  const invalid = loan('INVALID', 'bad date');
  const received = [];
  received[14] = LENDING_STATUS.RETURN_RECEIVED;
  const pending = [];
  Object.assign(pending, { 0: 'RET-PENDING', 14: LENDING_STATUS.RETURN_PENDING });
  const message = buildDailySummary(
    {
      loans: [old, today, returned, invalid],
      active: [old, today, returned, invalid],
      returns: [received, pending],
    },
    new Date('2026-11-04T18:00:00Z'),
  );
  assert.match(message.subject, /05\/11\/2569/);
  assert.match(message.text, /รอดำเนินการ: 3 รายการ/);
  assert.match(message.text, /รายการรอรับคืน: 1 รายการ/);
  const overdue = message.text.split('รายการยืมเกินกำหนดที่ยังไม่รับคืน:')[1];
  assert.match(overdue, /1 รายการ\n- OVERDUE/);
  assert.doesNotMatch(overdue, /TODAY|RETURNED|INVALID/);
});
test('mail settings reject missing credentials and header injection', () => {
  assert.throws(() => mailSettings({}), /SMTP_HOST/);
  const env = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASS: 'secret',
    MAIL_FROM: 'sender@example.com',
  };
  const settings = mailSettings(env, 'a@example.com');
  assert.equal(settings.transport.requireTLS, true);
  assert.deepEqual(settings.to, ['a@example.com']);
  assert.equal(mailSettings({ ...env, SMTP_PORT: '465' }, 'a@example.com').transport.secure, true);
  assert.throws(() => mailSettings(env, 'a@example.com\r\nBcc:evil@example.com'));
  assert.throws(() => mailSettings(env, 'a@example.com,b@example.com'));
  assert.throws(() => mailSettings({ ...env, SMTP_PORT: 'NaN' }, 'a@example.com'));
});
test('mailer renders a message without contacting SMTP using JSON transport', async () => {
  const mailer = createMailer({
    from: 'sender@example.com',
    to: ['a@example.com'],
    transport: { jsonTransport: true },
  });
  const info = await mailer.send({ subject: 'Daily', text: 'Summary' });
  const message = JSON.parse(info.message);
  assert.equal(message.subject, 'Daily');
  assert.equal(message.text, 'Summary');
  assert.equal(message.to[0].address, 'a@example.com');
});
