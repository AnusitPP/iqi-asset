import { publicUser } from '../repositories/user.repository.js';
import { SESSION_LIFETIME_MS, sessionCookieOptions } from '../../../core/config/session.config.js';
export const readSessionCookie = (req) =>
  req.get('cookie')?.match(/(?:^|;\s*)iqi_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
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
