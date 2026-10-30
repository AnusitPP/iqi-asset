import { sessionCookieOptions } from '../../../core/config/session.config.js';
import { loadGoogleAuthConfig } from '../../../core/config/google-auth.config.js';
import { completeGoogleLogin } from '../services/google-callback.service.js';

export function googleCallbackController(config, startSession, failedLogin) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const cookies = req.get('cookie') || '';
    const cookieValue = (name) =>
      cookies
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(name + '='))
        ?.slice(name.length + 1);
    const options = {
      ...sessionCookieOptions(config, req),
      path: '/api/auth/google',
    };
    res.clearCookie('google_oauth_state', options);
    res.clearCookie('google_oauth_nonce', options);
    try {
      const identity = await completeGoogleLogin(config.googleAuth || loadGoogleAuthConfig(), {
        code: req.query.code,
        state: req.query.state,
        error: req.query.error,
        expectedState: cookieValue('google_oauth_state'),
        nonce: cookieValue('google_oauth_nonce'),
      });
      await startSession(req, res, identity);
      res.redirect(303, '/');
    } catch (error) {
      if (failedLogin) {
        try {
          await failedLogin();
        } catch {
          /* Storage failures must never authenticate. */
        }
      }
      next(error);
    }
  };
}
