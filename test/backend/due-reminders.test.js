import { LENDING_STATUS } from '../../shared/features/lending/status.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLoanEmails,
  readLoanEmails,
  buildDueReminders,
  deliverDueReminders,
} from '../../backend/src/features/mail/due-reminders.js';
import { smtpSettings } from '../../backend/src/features/mail/mailer.js';

const loan = (id, due, borrower = id) => {
  const row = [];
  Object.assign(row, {
    0: id,
    3: borrower,
    7: `ASSET-${id}`,
    9: 'Laptop',
    12: due,
    14: 'รอดำเนินการ',
  });
  return row;
};
test('reminders use Bangkok calendar dates, group by email and keep other recipients private', () => {
  const plan = buildDueReminders(
    {
      active: [
        loan('A', '2026-11-06'),
        loan('B', '6/11/2569'),
        loan('C', '2026-11-06'),
        loan('TODAY', '2026-11-05'),
        loan('TWO_DAYS', '2026-11-07'),
        loan('LATER', '2026-11-08'),
        loan('OVERDUE', '2026-11-04'),
        loan('MISSING', '2026-11-06'),
        loan('INVALID', 'oops'),
        Object.assign(loan('RETURNED', '2026-11-06'), { 14: LENDING_STATUS.RETURNED }),
      ],
    },
    new Map([
      ['A', 'alice@example.com'],
      ['B', 'ALICE@example.com'],
      ['C', 'bob@example.com'],
    ]),
    new Date('2026-11-04T18:00:00Z'),
  );
  assert.equal(plan.messages.length, 2);
  assert.equal(plan.missingEmails, 1);
  assert.equal(plan.invalidDates, 1);
  assert.match(plan.messages[0].text, /ASSET-A/);
  assert.match(plan.messages[0].text, /ASSET-B/);
  assert.doesNotMatch(plan.messages[0].text, /ASSET-C|bob@|TODAY|TWO_DAYS|LATER|OVERDUE|RETURNED/);
  assert.match(plan.messages[0].subject, /ล่วงหน้า 1 วัน/);
  assert.match(plan.messages[0].text, /อีก 1 วัน/);
  assert.match(plan.messages[1].text, /ASSET-C/);
  assert.doesNotMatch(plan.messages[1].text, /ASSET-A|ASSET-B|alice@/);
});
test('email source matches IDs across reordered rows and rejects ambiguous headers or IDs', () => {
  const emails = parseLoanEmails([
    ['email', 'เลขรายการยืม'],
    ['b@example.com', 'B'],
    ['a@example.com', 'A'],
  ]);
  assert.equal(emails.get('A'), 'a@example.com');
  for (const rows of [
    [['เลขรายการยืม']],
    [['เลขรายการยืม', 'email', 'email']],
    [
      ['เลขรายการยืม', 'email'],
      ['A', 'a@example.com'],
      ['A', 'b@example.com'],
    ],
    [
      ['เลขรายการยืม', 'email'],
      ['', 'a@example.com'],
    ],
  ])
    assert.throws(() => parseLoanEmails(rows), { code: 'EMAIL_SOURCE' });
  assert.throws(
    () =>
      buildDueReminders(
        { active: [loan('A', '2026-11-06')] },
        new Map([['A', 'a@example.com,b@example.com']]),
        new Date('2026-11-05T01:00:00Z'),
      ),
    { code: 'EMAIL_SOURCE' },
  );
});
test('reads configured recipient sheet without writing and escapes sheet names', async () => {
  let request;
  const emails = await readLoanEmails(
    {
      config: { spreadsheetId: 'original' },
      api: {
        spreadsheets: {
          values: {
            get: async (args) => {
              request = args;
              return {
                data: {
                  values: [
                    ['id', 'email'],
                    ['A', 'a@example.com'],
                  ],
                },
              };
            },
          },
        },
      },
    },
    {
      MAIL_REMINDER_SPREADSHEET_ID: 'recipients',
      MAIL_REMINDER_SHEET: "User's emails",
      MAIL_REMINDER_ID_HEADER: 'id',
      MAIL_REMINDER_EMAIL_HEADER: 'email',
    },
  );
  assert.equal(request.spreadsheetId, 'recipients');
  assert.equal(request.range, "'User''s emails'");
  assert.equal(emails.get('A'), 'a@example.com');
});
test('delivery isolates recipients, never falls back to MAIL_TO and continues after one SMTP failure', async () => {
  const sent = [];
  const result = await deliverDueReminders(
    {
      messages: [
        { email: 'a@example.com', subject: 'A', text: 'Only A' },
        { email: 'b@example.com', subject: 'B', text: 'Only B' },
      ],
    },
    (email) => ({
      send: async (message) => {
        sent.push({ to: email, message });
        if (email === 'a@example.com') throw Error('SMTP failure');
      },
    }),
  );
  assert.deepEqual(result, { sent: 1, failed: 1 });
  assert.deepEqual(
    sent.map((mail) => mail.to),
    ['a@example.com', 'b@example.com'],
  );
});
test('SMTP verification settings do not require a global recipient', () => {
  const settings = smtpSettings({
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'u',
    SMTP_PASS: 'p',
    MAIL_FROM: 'sender@example.com',
  });
  assert.equal(settings.to, undefined);
});
