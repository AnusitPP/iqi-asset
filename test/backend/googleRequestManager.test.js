import test from 'node:test';
import assert from 'node:assert/strict';
import { google } from 'googleapis';
import { manageGoogleClient, runGoogleRequest, isTransientGoogleError } from '../../backend/src/integrations/google/request-manager.js';

const googleError = (status, reason) => Object.assign(new Error('Google failed'), {
  response: { status, data: { error: { errors: reason ? [{ reason }] : [] } }, headers: {} },
});

test('retries transient read failures with a bounded number of attempts', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  let calls = 0;
  try {
    await assert.rejects(runGoogleRequest(async () => {
      calls++;
      throw googleError(503);
    }, { retryable: true }), /Google failed/);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 4);
});

test('retries quota-rate reasons and network errors, but not permission failures', () => {
  assert.equal(isTransientGoogleError(googleError(403, 'rateLimitExceeded')), true);
  assert.equal(isTransientGoogleError(googleError(403, 'userRateLimitExceeded')), true);
  assert.equal(isTransientGoogleError(googleError(403, 'insufficientPermissions')), false);
  assert.equal(isTransientGoogleError(Object.assign(new Error('offline'), { code: 'ECONNRESET' })), true);
  assert.equal(isTransientGoogleError(new TypeError('fetch failed', {
    cause: Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }),
  })), true);
});

test('deduplicates identical concurrent reads through the managed Google client', async () => {
  let calls = 0;
  const client = manageGoogleClient({
    spreadsheets: {
      values: {
        get: async () => {
          calls++;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { data: { values: [['ok']] } };
        },
      },
    },
  });
  const request = { spreadsheetId: 'sheet', range: 'A1' };
  const [first, second] = await Promise.all([
    client.spreadsheets.values.get(request),
    client.spreadsheets.values.get(request),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
});

test('preserves googleapis read-only resource properties while managing methods', () => {
  const client = google.sheets({ version: 'v4' });
  const spreadsheets = client.spreadsheets;
  const originalGet = spreadsheets.get;
  const managed = manageGoogleClient(client);
  assert.equal(managed, client);
  assert.equal(managed.spreadsheets, spreadsheets);
  assert.notEqual(managed.spreadsheets.get, originalGet);
});

test('does not retry non-idempotent requests', async () => {
  let calls = 0;
  await assert.rejects(runGoogleRequest(async () => {
    calls++;
    throw googleError(429);
  }), /Google failed/);
  assert.equal(calls, 1);
});

test('limits concurrent Google requests to four per runtime', async () => {
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 12 }, () => runGoogleRequest(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active--;
  })));
  assert.equal(peak, 4);
});

test('honors Retry-After before retrying', async () => {
  let calls = 0;
  const started = Date.now();
  await runGoogleRequest(async () => {
    calls++;
    if (calls === 1) {
      const error = googleError(429);
      error.response.headers['retry-after'] = '0.02';
      throw error;
    }
    return 'ok';
  }, { retryable: true });
  assert.equal(calls, 2);
  assert.ok(Date.now() - started >= 15);
});
