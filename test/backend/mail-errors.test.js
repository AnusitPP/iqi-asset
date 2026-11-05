import test from 'node:test';
import assert from 'node:assert/strict';
import { mailErrorMessage, mailErrorDiagnostic } from '../../backend/src/features/mail/errors.js';

test('mail diagnostics explain missing settings and SMTP failures without leaking server details', () => {
  assert.equal(mailErrorMessage(new Error('กรุณาตั้งค่า SMTP_PASS')), 'กรุณาตั้งค่า SMTP_PASS');
  assert.match(mailErrorMessage({ code: 'EAUTH', message: 'secret password' }), /ล็อกอินไม่ผ่าน/);
  assert.match(mailErrorMessage({ code: 'ETIMEDOUT' }), /หมดเวลา/);
  for (const error of [
    new Error('secret password'),
    { code: 'UNKNOWN', message: 'secret password' },
    new Error('กรุณาตั้งค่า SMTP_PASS, secret password'),
  ])
    assert.doesNotMatch(mailErrorMessage(error), /secret password/);
});

test('Resend rejections explain sender verification or test-recipient restrictions without exposing responses', () => {
  const testing = {
    code: 'EMESSAGE',
    responseCode: 550,
    response:
      '550 You can only send testing emails to your own email address (secret@example.com). re_PRIVATE_KEY',
  };
  assert.match(mailErrorMessage(testing), /อีเมลที่ใช้สมัคร Resend/);
  assert.doesNotMatch(mailErrorMessage(testing), /secret@example.com|re_PRIVATE_KEY/);
  const domain = {
    code: 'EENVELOPE',
    response: '550 The step.cmu.ac.th domain is not verified. re_PRIVATE_KEY',
  };
  assert.match(mailErrorMessage(domain), /ยังไม่ยืนยันโดเมนผู้ส่ง/);
  assert.doesNotMatch(mailErrorMessage(domain), /re_PRIVATE_KEY/);
  assert.deepEqual(mailErrorDiagnostic(testing), { code: 'EMESSAGE', smtpStatus: 550 });
  assert.deepEqual(mailErrorDiagnostic({ code: 're_PRIVATE_KEY', responseCode: 'secret' }), {});
  assert.match(mailErrorMessage({ code: 'EMESSAGE' }), /SMTP ปฏิเสธข้อความ/);
});
