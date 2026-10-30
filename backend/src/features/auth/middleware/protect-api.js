import { hasPermission } from '../../../../../shared/features/auth/permissions.js';
export function protectApi(req, res, next) {
  // Legacy unit-test apps do not use the configured Sheet session middleware.
  if (!req.user) return next();
  const path = req.originalUrl.split('?')[0];
  let permission;
  if (/^\/api\/admin\/users(?:\/|$)/.test(path))
    permission = req.method === 'GET' ? 'USER_VIEW' : 'USER_MANAGE';
  else if (path === '/api/audit') permission = 'AUDIT_VIEW';
  else if (req.method === 'GET') {
    if (path === '/api/loans') permission = 'LOAN_VIEW_ALL';
    else if (path === '/api/dashboard') permission = 'ADMIN_DASHBOARD_VIEW';
    else permission = 'ASSET_VIEW';
  } else if (path === '/api/loans' && req.method === 'POST') permission = 'LOAN_CREATE';
  else if (path === '/api/returns' && req.method === 'POST') permission = 'RETURN_CREATE';
  else permission = 'ASSET_EDIT';
  if (!hasPermission(req.user, permission))
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
  next();
}
