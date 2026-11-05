import test from 'node:test';
import assert from 'node:assert/strict';
import { mailErrorMessage } from '../../backend/src/features/mail/errors.js';

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
