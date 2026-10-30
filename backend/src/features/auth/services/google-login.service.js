import { loadGoogleAuthConfig } from '../../../core/config/google-auth.config.js';
import { createOAuthState, createOAuthNonce } from '../../../core/security/oauth-state.js';
import { buildGoogleAuthorizationUrl } from '../../../integrations/google/oauth/google-oauth.client.js';

export function startGoogleLogin(config = loadGoogleAuthConfig()) {
  const state = createOAuthState();
  const nonce = createOAuthNonce();
  return { authorizationUrl: buildGoogleAuthorizationUrl(config, { state, nonce }), state, nonce };
}
