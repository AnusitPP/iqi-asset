import express from 'express';
import { createAuthRoutes } from './auth.routes.js';
import { AuthSheetStorage } from '../../integrations/google/auth-storage.js';
import { SheetSessionService } from './services/session.service.js';
import { createSessionController, readSessionCookie } from './controllers/session.controller.js';
export function createSheetAuth(config, csrf) {
  const router = express.Router();
  const storage = config.authStorage || new AuthSheetStorage(config);
  const sessions = new SheetSessionService(storage, config);
  const controller = createSessionController(sessions, config, csrf);
  router.use(
    '/auth',
    createAuthRoutes(config, controller.login, () => sessions.failedLogin()),
  );
  router.get('/auth/session', controller.current);
  router.get('/auth/me', controller.current);
  router.post('/auth/logout', controller.logout);
  router.post('/auth/login', (req, res) =>
    res.status(410).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' }),
  );
  router.use(async (req, res, next) => {
    const active = await sessions.read(readSessionCookie(req));
    if (!active) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' });
    req.user = active.user;
    req.authStorage = storage;
    next();
  });
  return router;
}
