import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildLoanConfirmation } from '../../backend/src/features/mail/loan-confirmation.js';
import { buildDailySummary } from '../../backend/src/features/mail/daily-summary.js';
import {
  buildDueReminders,
  deliverDueReminders,
} from '../../backend/src/features/mail/due-reminders.js';
import { renderMailTemplate } from '../../backend/src/features/mail/templates.js';
import { createMailer } from '../../backend/src/features/mail/mailer.js';
import { LENDING_STATUS } from '../../shared/features/lending/status.js';

const loan = (id, emailName) => {
  const row = Array(19).fill('');
  Object.assign(row, {
    0: id,
    3: emailName,
    7: `ASSET-${id}`,
    9: `Device ${id}`,
    10: '<img src=x onerror="alert(1)"> & details',
    11: '2026-11-05',
    12: '2026-11-06',
    14: LENDING_STATUS.LOAN_PENDING,
  });
  return row;
};
const env = { FRONTEND_URL: 'https://portal.example.com' };
const now = new Date('2026-11-05T01:00:00Z');
test('confirmation renders escaped sheet data and safe app link with a readable text alternative', () => {
  const row = loan('A', 'Alice <script>alert(1)</script>');
  const message = buildLoanConfirmation(row, env);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; details/);
  assert.doesNotMatch(message.html, /<script|<img src=x/);
  assert.match(message.html, /href="https:\/\/portal.example.com\/my-requests"/);
  assert.match(message.text, /ASSET-A/);
  assert.match(message.text, /06\/11\/2569/);
});
test('reminder HTML and text remain isolated per recipient and survive delivery', async () => {
  const plan = buildDueReminders(
    { active: [loan('A', 'Alice'), loan('B', 'Bob')] },
    new Map([
      ['A', 'a@example.com'],
      ['B', 'b@example.com'],
    ]),
    now,
    env,
  );
  const delivered = [];
  await deliverDueReminders(plan, (email) => ({
    send: async (message) => delivered.push({ email, message }),
  }));
  assert.equal(delivered.length, 2);
  assert.match(delivered[0].message.html, /ASSET-A/);
  assert.doesNotMatch(delivered[0].message.html, /ASSET-B|Bob/);
  assert.match(delivered[1].message.html, /ASSET-B/);
  assert.doesNotMatch(delivered[1].message.html, /ASSET-A|Alice/);
  assert.match(delivered[0].message.text, /1 วัน/);
});
test('summary respects selected sections in HTML and empty groups render clearly', () => {
  const state = { loans: [loan('A', 'Alice')], returns: [], active: [] };
  const returning = buildDailySummary(state, now, 'return', env);
  assert.doesNotMatch(returning.html, /ASSET-A|คำขอยืมรอดำเนินการ/);
  assert.match(returning.html, /ไม่มีรายการที่ต้องดำเนินการ/);
  const borrowing = buildDailySummary(state, now, 'loan', env);
  assert.match(borrowing.html, /ASSET-A/);
  assert.doesNotMatch(borrowing.html, /รายการรอรับคืน ·/);
});
test('unsafe, missing or credential-bearing app URLs do not render links', () => {
  for (const base of [undefined, 'javascript:alert(1)', 'https://user:secret@example.com']) {
    const html = renderMailTemplate({
      title: 'Title',
      intro: 'Intro',
      label: 'Label',
      sections: [],
      env: { APP_URL: base },
    });
    assert.doesNotMatch(html, /href=|user:secret/);
  }
});
test('mailer includes both HTML and plain text without contacting SMTP', async () => {
  const message = buildLoanConfirmation(loan('A', 'Alice'), env);
  const result = await createMailer({
    from: 'sender@example.com',
    to: ['alice@example.com'],
    transport: { jsonTransport: true },
  }).send(message);
  const serialized = JSON.parse(result.message);
  assert.equal(serialized.html, message.html);
  assert.equal(serialized.text, message.text);
});

test('corporate summary has one empty state, three zero counters, original logo and corporate header', () => {
  const { html } = buildDailySummary({ loans: [], returns: [], active: [] }, now, 'summary', env);
  assert.equal(html.split('ไม่มีรายการที่ต้องดำเนินการ').length - 1, 1);
  assert.doesNotMatch(html, /ไม่มีรายการในกลุ่มนี้|รายการยืมเกินกำหนด ·|รายการรอรับคืน ·/);
  const doc = new JSDOM(html).window.document;
  assert.equal(
    [...doc.querySelectorAll('div')].filter((node) => node.textContent.trim() === '0').length,
    3,
  );
  assert.match(html, /src="https:\/\/portal.example.com\/icon.png"/);
  assert.equal(doc.querySelector('img').width, 44);
  assert.match(html, /color:#FFFFFF/);
  assert.doesNotMatch(html, /<script|<svg|display:\s*(flex|grid)|<style/);
  for (const color of ['#FFCC00', '#F1F2F4', '#FFFFFF', '#202124', '#71717A', '#E4E4E7', '#27824A'])
    assert.ok(html.includes(color));
});

test('single loan renders details, purpose, nickname and Buddhist dates with no empty group', () => {
  const row = loan('SINGLE', 'Alice');
  const { html } = buildDailySummary(
    { loans: [row], returns: [], active: [], nicknames: new Map([['alice', 'A<&']]) },
    now,
    'summary',
    env,
  );
  assert.match(html, /Alice \(A&lt;&amp;\)/);
  assert.match(html, /5 พ.ย. 2569/);
  assert.match(html, /6 พ.ย. 2569/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(
    html,
    /ไม่มีรายการที่ต้องดำเนินการ|รายการรอรับคืน ·|รายการยืมเกินกำหนด ·|เกินกำหนด \d+ วัน/,
  );
});

test('overdue comes first alongside approvals and returns, preserving overlapping memberships', () => {
  const overdue = loan('OLD', 'Alice');
  overdue[12] = '2026-11-04';
  const pending = loan('NEW', 'Bob');
  const returning = Array(19).fill('');
  Object.assign(returning, {
    0: 'RETURN',
    1: 'NEW',
    4: 'Bob',
    8: 'ASSET-NEW',
    10: 'Device NEW',
    11: '2026-11-05',
    14: LENDING_STATUS.RETURN_PENDING,
  });
  const state = { loans: [overdue, pending], returns: [returning], active: [overdue, pending] };
  // At 17:00 UTC the Bangkok civil date has advanced to November 5.
  const { html } = buildDailySummary(state, new Date('2026-11-04T17:00:00Z'), 'summary', env);
  assert.match(html, /เกินกำหนด 1 วัน/);
  assert.match(html, /รายการรออนุมัติ/);
  assert.match(html, /รายการรอรับคืน/);
  assert.ok(html.indexOf('รายการยืมเกินกำหนด') < html.indexOf('รายการรออนุมัติ'));
  assert.ok(html.indexOf('รายการรออนุมัติ') < html.indexOf('รายการรอรับคืน'));
  const doc = new JSDOM(html).window.document;
  assert.equal(
    [...doc.querySelectorAll('div')].filter((node) => node.textContent.trim() === 'Device OLD')
      .length,
    2,
  );
  assert.match(html, /width="65%"/);
  assert.match(html, /background:#FEE4E2;color:#B42318/);
  assert.match(html, /มีอุปกรณ์เกินกำหนดส่งคืน 1 รายการ/);
  assert.match(html, /สถานะ|รอดำเนินการ/);
  const previous = buildDailySummary(state, new Date('2026-11-04T16:59:59Z'), 'summary', env);
  assert.doesNotMatch(previous.html, /เกินกำหนด 1 วัน/);
});
