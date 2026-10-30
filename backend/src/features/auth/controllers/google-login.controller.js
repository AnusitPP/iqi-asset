import { sessionCookieOptions } from '../../../core/config/session.config.js';
import { startGoogleLogin } from '../services/google-login.service.js';

export function googleLoginController(config) {
  return (req, res, next) => {
    try {
      const { authorizationUrl, state, nonce } = startGoogleLogin(config.googleAuth);
      const options = {
        ...sessionCookieOptions(config, req),
        maxAge: 10 * 60 * 1000,
        path: '/api/auth/google',
      };
      res.set('Cache-Control', 'no-store');
      res.cookie('google_oauth_state', state, options);
      res.cookie('google_oauth_nonce', nonce, options);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      next(error);
    }
  };
}
