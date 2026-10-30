import { google } from 'googleapis';

export function buildGoogleAuthorizationUrl(config, { state, nonce }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    // Domain hint only; the callback must verify the ID token's hd claim.
    hd: config.allowedDomain,
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

export function createGoogleOAuthClient(config) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}
