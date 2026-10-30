# Google Login — Phase 1

Implemented only GET /api/auth/google. Password login remains unchanged.

## Files
- core/config/google-auth.config.js: sole reader/validator of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ALLOWED_DOMAIN; validated before use.
- core/security/oauth-state.js: independent cryptographic state and nonce.
- integrations/google/oauth/google-oauth.client.js: Google authorization URL only.
- features/auth/services/google-login.service.js: starts the login use case.
- features/auth/controllers/google-login.controller.js: temporary HttpOnly cookies and redirect.
- features/auth/auth.routes.js: GET /google mapping.
- http/app.js: mounts public auth routes before password authentication and Sheets readiness.
- .env.example: variable names only; test/integration/googleLogin.test.js: protocol, randomness, config, HTTP and compatibility checks.

## Local test
Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_ALLOWED_DOMAIN=step.cmu.ac.th in the ignored .env, then restart npm run dev. Open http://localhost:3000/api/auth/google. Expect HTTP 302, Google account selection and two 10-minute cookies. Production cookies use Secure; SameSite=Lax and HttpOnly apply everywhere.

## Production test
Set the three variables in the Vercel deployment environment and redeploy the desired commit. Register exactly https://iqi-asset.vercel.app/api/auth/google/callback as an authorized redirect URI in the Google Cloud OAuth web client. Open https://iqi-asset.vercel.app/api/auth/google and verify account selection. No APP_URL/BASE_URL currently exists, so the callback URL is centralized in Google auth config. Local tests intentionally use that same callback.

## Limits
No callback, token exchange/verification, user database, role/permission, new session/logout or UI changes. Selecting an account does not log into this app; the callback is unimplemented and may fail. Existing auth middleware can return 401 instead of 404 for that callback. hd is a Google UI hint, not access control. The future callback must verify state, nonce, ID token signature/issuer/audience/expiry, email_verified and hd. Never reuse Sheets/Drive credentials for user login or expose the client secret. Browser account selection requires a real, correctly configured OAuth client; automated tests use dummy credentials and do not submit a Google account.

Reference: https://developers.google.com/identity/openid-connect/openid-connect


## Phase 2 — callback
GET /api/auth/google/callback is now public and runs before the password guard and Sheets readiness. It compares state against the temporary cookie, exchanges code through the existing googleapis OAuth2 client, and uses verifyIdToken with the configured audience (Google signature, issuer and expiry validation). The service additionally checks nonce, email_verified, hd, email domain and subject. On success the existing session issuer creates an 30-minute session and redirects to /. Temporary cookies are cleared on success and failure. Password login is preserved.

New files: services/google-callback.service.js and controllers/google-callback.controller.js. Updated auth.routes.js, middleware.js (shared session issuer), Google OAuth client, Google auth config and oauth-state.js. Tests cover rejected state, malformed/missing parameters, cancellation, rejected claims and sanitized token errors.

Local callback now defaults to http://localhost:3000/api/auth/google/callback. Production defaults to https://iqi-asset.vercel.app/api/auth/google/callback. APP_URL can override the origin; it must be HTTPS except HTTP localhost/127.0.0.1. Register each exact callback URI in the Google Cloud web OAuth client's Authorized redirect URIs. Start a fresh login after restarting; do not reuse authorization codes or callback links from earlier attempts.

No database, role/permission changes or replacement login UI were added. Google users currently receive the same access as the existing password login. Session revocation retains the existing process-local limitation on Vercel; no cross-instance revocation guarantee is introduced. Production has not been deployed by this change. A real account sign-in remains a user-operated check.
