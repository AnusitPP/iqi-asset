import express from 'express';
import { createSheetAuth } from './sheet.middleware.js';
import { createAuthRoutes } from './auth.routes.js';
import { configurationError } from '../../core/config/credentials.js';
import { resetSessionController } from './controllers/session.controller.js';

export function createAuth(config, csrf) {
  const router = express.Router();
  router.get('/auth/recovery', (_req, res) => res.json({ csrf }));
  if (config.authSpreadsheetId || config.authStorage) {
    router.use(createSheetAuth(config, csrf));
    return router;
  }
  router.post('/auth/reset', resetSessionController(config));
  const missingConfiguration = () => {
    throw configurationError('กรุณาตั้งค่า AUTH_SPREADSHEET_ID สำหรับ Google Login');
  };
  router.use('/auth', createAuthRoutes(config, missingConfiguration));
  router.get(['/auth/session', '/auth/me'], (_req, res) =>
    res.status(503).json({ error: 'กรุณาตั้งค่า AUTH_SPREADSHEET_ID สำหรับ Google Login' }),
  );
  router.post('/auth/login', (_req, res) =>
    res.status(410).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' }),
  );
  router.use((_req, res) => res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' }));
  return router;
}
