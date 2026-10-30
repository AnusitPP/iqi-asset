import { googleCallbackController } from './controllers/google-callback.controller.js';
import { Router } from 'express';
import { googleLoginController } from './controllers/google-login.controller.js';

export function createAuthRoutes(config, startSession, failedLogin) {
  const router = Router();
  router.get('/google', googleLoginController(config));
  router.get('/google/callback', googleCallbackController(config, startSession, failedLogin));
  return router;
}
