import { hasPermission } from '../../../../../shared/features/auth/permissions.js';
import { throwHttpError } from '../../../core/errors/errors.js';
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) throwHttpError(401, 'กรุณาเข้าสู่ระบบด้วย Google');
    if (!permissions.every((permission) => hasPermission(req.user, permission)))
      throwHttpError(403, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
    next();
  };
}
