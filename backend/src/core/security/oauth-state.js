import { randomBytes, timingSafeEqual } from 'node:crypto';

export const createOAuthState = () => randomBytes(32).toString('base64url');
export const createOAuthNonce = () => randomBytes(32).toString('base64url');

export function matchesOAuthValue(actual, expected) {
  return (
    typeof actual === 'string' &&
    typeof expected === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(actual) &&
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
