import test from 'node:test';
import assert from 'node:assert/strict';
import { completeGoogleLogin } from '../../backend/src/features/auth/services/google-callback.service.js';
import { createOAuthState, createOAuthNonce } from '../../backend/src/core/security/oauth-state.js';
import { loadGoogleAuthConfig } from '../../backend/src/core/config/google-auth.config.js';
import { googleCallbackController } from '../../backend/src/features/auth/controllers/google-callback.controller.js';
const config = { clientId: 'id', clientSecret: 'secret', allowedDomain: 'step.cmu.ac.th' };
const state = createOAuthState(),
  nonce = createOAuthNonce();
const request = { code: 'code', state, expectedState: state, nonce };
const payload = {
  sub: '123',
  name: 'User',
  email: 'user@step.cmu.ac.th',
  hd: 'step.cmu.ac.th',
  email_verified: true,
  nonce,
};
const client = (identity) => ({
  getToken: async (code) => {
    assert.equal(code, 'code');
    return { tokens: { id_token: 'verified-by-google-library' } };
  },
  verifyIdToken: async (options) => {
    assert.equal(options.audience, 'id');
    return { getPayload: () => identity };
  },
});

test('verified Google picture passes only trusted Google image origins', async () => {
  const avatar = 'https://lh3.googleusercontent.com/a/example=s96-c';
  const identity = await completeGoogleLogin(
    config,
    request,
    client({ ...payload, picture: avatar }),
  );
  assert.equal(identity.avatar_url, avatar);
  const unsafe = await completeGoogleLogin(
    config,
    request,
    client({ ...payload, picture: 'https://attacker.example/photo.png' }),
  );
  assert.equal(unsafe.avatar_url, undefined);
});
test('callback exchanges code and accepts verified organization identity', async () => {
  assert.deepEqual(await completeGoogleLogin(config, request, client(payload)), {
    sub: '123',
    email: payload.email,
    name: 'User',
  });
});
test('callback rejects CSRF, missing nonce, cancellation, duplicate query and missing code before exchange', async () => {
  let exchanges = 0;
  const fake = {
    getToken: async () => {
      exchanges++;
      throw new Error();
    },
  };
  for (const values of [
    { state: createOAuthState() },
    { expectedState: undefined },
    { nonce: undefined },
    { error: 'access_denied' },
    { code: '' },
    { state: [state] },
  ])
    await assert.rejects(
      completeGoogleLogin(config, { ...request, ...values }, fake),
      (e) => e.status === 400,
    );
  assert.equal(exchanges, 0);
});
test('callback rejects unverified email, wrong domain, nonce replay and missing subject', async () => {
  for (const values of [
    { email_verified: false },
    { hd: 'gmail.com' },
    { email: 'user@gmail.com' },
    { nonce: createOAuthNonce() },
    { sub: '' },
  ])
    await assert.rejects(
      completeGoogleLogin(config, request, client({ ...payload, ...values })),
      (e) => e.status === 403,
    );
});
test('Google token verification errors are sanitized', async () => {
  await assert.rejects(
    completeGoogleLogin(config, request, {
      getToken: async () => {
        throw new Error('private secret');
      },
    }),
    (e) => e.status === 401 && !e.message.includes('private secret'),
  );
});
test('callback clears temporary cookies on failure and never creates a session', async () => {
  const cleared = [];
  let failure,
    started = false;
  await googleCallbackController({ googleAuth: config }, async () => {
    started = true;
  })(
    { query: {}, get: () => '', secure: false },
    {
      set() {},
      clearCookie(name) {
        cleared.push(name);
      },
    },
    (e) => {
      failure = e;
    },
  );
  assert.equal(failure.status, 400);
  assert.equal(started, false);
  assert.deepEqual(cleared, ['google_oauth_state', 'google_oauth_nonce']);
});
test('callback URI is environment-specific and ignores untrusted request hosts', () => {
  const env = {
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_ALLOWED_DOMAIN: 'step.cmu.ac.th',
  };
  assert.equal(
    loadGoogleAuthConfig(env).redirectUri,
    'http://localhost:3000/api/auth/google/callback',
  );
  assert.equal(
    loadGoogleAuthConfig({ ...env, VERCEL: '1' }).redirectUri,
    'https://iqi-asset.vercel.app/api/auth/google/callback',
  );
  assert.throws(() => loadGoogleAuthConfig({ ...env, APP_URL: 'http://evil.example' }), /APP_URL/);
});
