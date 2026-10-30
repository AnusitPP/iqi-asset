import test from 'node:test';
import assert from 'node:assert/strict';
import { googleProfileImageUrl } from '../../shared/features/auth/profile.js';
test('profile pictures accept exact Google HTTPS image origins and reject lookalikes', () => {
  const url = 'https://lh3.googleusercontent.com/a/photo=s96-c';
  assert.equal(googleProfileImageUrl(url), url);
  for (const value of [
    undefined,
    '',
    'http://lh3.googleusercontent.com/a',
    'https://lh3.googleusercontent.com.evil.test/a',
    'https://user:pass@lh3.googleusercontent.com/a',
    'https://lh3.googleusercontent.com:444/a',
    'https://example.com/a',
  ])
    assert.equal(googleProfileImageUrl(value), '', String(value));
});
