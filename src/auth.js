import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { StateStore } from './state.js';
const LIFETIME = 8 * 60 * 60 * 1000;
export function createAuth(config, csrf) {
  const router = express.Router();
  const state = config.state || new StateStore();
  const salt = randomBytes(16);
  const hash = scryptSync(config.password || '1234', salt, 32);
  const token = (req) => req.get('cookie')?.match(/(?:^|;\s*)iqi_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const authenticated = async (req) => {
    const id = token(req);
    return !!id && (await state.get(`session:${id}`)) === true;
  };
  const cookieOptions = (req) => ({
    httpOnly: true, sameSite: 'strict', secure: config.hosted || req.secure, path: '/',
  });
  router.get('/auth/session', async (req, res) => res.json({ authenticated: await authenticated(req), csrf }));
  router.post('/auth/login', async (req, res) => {
    const ip = createHash('sha256').update(req.ip || '').digest('hex');
    await state.withLock(`login:${ip}`, async () => {
      const key = `attempt:${ip}`;
      const attempt = await state.get(key);
      if (attempt?.count >= 5) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((attempt.until - Date.now()) / 1000))));
        return res.status(429).json({ error: 'กรอกรหัสผิดหลายครั้ง กรุณารอ 1 นาทีแล้วลองใหม่' });
      }
      const password = req.body?.password;
      const valid = typeof password === 'string' && password.length <= 256 &&
        timingSafeEqual(hash, scryptSync(password, salt, 32));
      if (!valid) {
        const next = attempt || { count: 0, until: Date.now() + 60000 };
        next.count++;
        if (next.count >= 5) next.until = Date.now() + 60000;
        await state.set(key, next, Math.max(1, next.until - Date.now()));
        return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
      }
      await state.delete(key);
      if (token(req)) await state.delete(`session:${token(req)}`);
      const id = randomBytes(32).toString('hex');
      await state.set(`session:${id}`, true, LIFETIME);
      res.cookie('iqi_session', id, { ...cookieOptions(req), maxAge: LIFETIME });
      res.json({ authenticated: true });
    });
  });
  router.post('/auth/logout', async (req, res) => {
    if (token(req)) await state.delete(`session:${token(req)}`);
    res.clearCookie('iqi_session', cookieOptions(req));
    res.json({ authenticated: false });
  });
  router.use(async (req, res, next) => {
    if (!(await authenticated(req)))
      return res.status(401).json({ error: 'กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน' });
    next();
  });
  return router;
}
