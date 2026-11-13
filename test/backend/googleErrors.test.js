import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationErrorCode, isRetryableError, safeMessage } from '../../backend/src/core/errors/errors.js';

const googleError = (status, reason) => Object.assign(new Error('private Google detail'), {
  name: 'GaxiosError',
  response: {
    status,
    data: { error: { errors: reason ? [{ reason }] : [] } },
  },
});

test('maps Google rate limits and transient availability failures to safe messages', () => {
  const rateLimit = googleError(403, 'userRateLimitExceeded');
  assert.equal(applicationErrorCode(rateLimit, 403), 'GOOGLE_API_RATE_LIMIT');
  assert.equal(isRetryableError(rateLimit, 403), true);
  assert.match(safeMessage(rateLimit), /คำขอใช้งานจำนวนมาก/);
  assert.equal(applicationErrorCode(googleError(503), 503), 'GOOGLE_API_UNAVAILABLE');
  assert.equal(isRetryableError(googleError(503), 503), true);
});

test('does not expose Google response details for permission errors', () => {
  const denied = googleError(403, 'insufficientPermissions');
  assert.equal(applicationErrorCode(denied, 403), 'GOOGLE_API_PERMISSION_DENIED');
  assert.equal(isRetryableError(denied, 403), false);
  assert.doesNotMatch(safeMessage(denied), /private Google detail/);
});

test('classifies wrapped fetch network failures as retryable temporary outages', () => {
  const error = new TypeError('fetch failed', {
    cause: Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }),
  });
  assert.equal(applicationErrorCode(error, 500), 'GOOGLE_API_UNAVAILABLE');
  assert.equal(isRetryableError(error, 500), true);
  assert.match(safeMessage(error), /เชื่อมต่อ Google ได้ชั่วคราว/);
});
