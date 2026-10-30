import { throwHttpError } from '../../../core/errors/errors.js';
export function requireAuth(req, res, next) {
  if (!req.user) throwHttpError(401, 'กรุณาเข้าสู่ระบบด้วย Google');
  next();
}
