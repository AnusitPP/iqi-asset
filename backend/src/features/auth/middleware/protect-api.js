import { hasPermission } from '../../../../../shared/features/auth/permissions.js';
export function protectApi(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' });
  const path = req.originalUrl.split('?')[0];
  let permission;
  if ((path === '/api/loan-catalog' && req.method !== 'GET') || /^\/api\/loan-catalog\//.test(path))
    permission = 'ASSET_EDIT';
  else if (path.startsWith('/api/catalog-photos/')) permission = 'LOAN_CREATE';
  else if (path === '/api/mail/send') permission = 'ADMIN_DASHBOARD_VIEW';
  else if (/^\/api\/admin\/users(?:\/|$)/.test(path))
    permission = req.method === 'GET' ? 'USER_VIEW' : 'USER_MANAGE';
  else if (path.startsWith('/api/approval-requests'))
    permission = req.method === 'GET' ? 'LOAN_VIEW_ALL' : 'LOAN_APPROVE';
  else if (path === '/api/audit') permission = 'AUDIT_VIEW';
  else if (req.method === 'GET') {
    if (path === '/api/my-requests') permission = 'LOAN_VIEW_OWN';
    else if (path === '/api/loan-catalog' || path === '/api/ready-to-borrow')
      permission = 'LOAN_CREATE';
    else if (path === '/api/return-catalog') permission = 'RETURN_CREATE';
    else if (path === '/api/loans') permission = 'LOAN_VIEW_ALL';
    else if (path.startsWith('/api/dashboard')) permission = 'ADMIN_DASHBOARD_VIEW';
    else permission = 'ASSET_VIEW';
  } else if (req.method === 'POST' && path.startsWith('/api/dashboard'))
    permission = 'ADMIN_DASHBOARD_VIEW';
  else if (path === '/api/loans' && req.method === 'POST') permission = 'LOAN_CREATE';
  else if (path === '/api/returns' && req.method === 'POST') permission = 'RETURN_CREATE';
  else permission = 'ASSET_EDIT';
  if (!hasPermission(req.user, permission))
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
  next();
}
