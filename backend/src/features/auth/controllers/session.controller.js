import { publicUser } from '../repositories/user.repository.js';
import { SESSION_LIFETIME_MS, sessionCookieOptions } from '../../../core/config/session.config.js';
import { logError } from '../../../core/errors/errors.js';
export const readSessionCookie = (req) =>
  req.get('cookie')?.match(/(?:^|;\s*)iqi_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
export function resetSessionController(config, service) {
  return async (req, res) => {
    const options = sessionCookieOptions(config, req);
    res.clearCookie('iqi_session', options);
    for (const name of ['google_oauth_state', 'google_oauth_nonce'])
      res.clearCookie(name, { ...options, path: '/api/auth/google' });
    try {
      await service?.logout(readSessionCookie(req));
    } catch (error) {
      // Cookie removal still signs this browser out when storage is unavailable.
      logError(error, 'Session reset');
    }
    res.json({ authenticated: false });
  };
}
export function createSessionController(service, config, csrf) {
  return {
    current: async (req, res) => {
      const active = await service.read(readSessionCookie(req));
      res.json({ authenticated: !!active, csrf, user: publicUser(active?.user) });
    },
    login: async (req, res, identity) => {
      const token = await service.login(identity, readSessionCookie(req));
      res.cookie('iqi_session', token, {
        ...sessionCookieOptions(config, req),
        maxAge: SESSION_LIFETIME_MS,
      });
    },
    logout: async (req, res) => {
      await service.logout(readSessionCookie(req));
      res.clearCookie('iqi_session', sessionCookieOptions(config, req));
      res.json({ authenticated: false });
    },
  };
}
