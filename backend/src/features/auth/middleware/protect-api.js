import {
  hasPermission,
  permissionsForRole,
} from '../../../../../shared/features/auth/permissions.js';
export function protectApi(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วย Google' });
  const path = req.originalUrl.split('?')[0].toLowerCase().replace(/\/$/, '');
  const previewRole = req.get?.('X-IQI-Preview-Role');
  if (previewRole !== undefined) {
    if (req.user.role !== 'SUPER_ADMIN' || !['ADMIN', 'STAFF'].includes(previewRole))
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ใช้มุมมองนี้' });
    const readOnlyMailPreview =
      req.method === 'POST' && ['/api/mail/preview', '/api/mail/mockup'].includes(path);
    if (!['GET', 'HEAD'].includes(req.method) && !readOnlyMailPreview)
      return res.status(403).json({ error: 'มุมมองตาม Role ใช้ดูข้อมูลได้อย่างเดียว' });
    req.user = { ...req.user, role: previewRole, permissions: permissionsForRole(previewRole) };
    res.set('Cache-Control', 'private, no-store');
  }
  let permission;
  if ((path === '/api/loan-catalog' && req.method !== 'GET') || /^\/api\/loan-catalog\//.test(path))
    permission = 'ASSET_EDIT';
  else if (path.startsWith('/api/catalog-photos/')) permission = 'LOAN_CREATE';
  else if (path.startsWith('/api/sheets/')) permission = 'SHEETS_VIEW';
  else if (path === '/api/mail/send' || path === '/api/mail/preview' || path === '/api/mail/mockup')
    permission = 'MAIL_VIEW';
  else if (/^\/api\/admin\/users(?:\/|$)/.test(path))
    permission = ['GET', 'HEAD'].includes(req.method) ? 'USER_VIEW' : 'USER_MANAGE';
  else if (path.startsWith('/api/approval-requests')) permission = 'LOAN_VIEW_ALL';
  else if (path === '/api/audit') permission = 'AUDIT_VIEW';
  else if (req.method === 'POST' && /^\/api\/my-requests\/[^/]+\/cancel$/.test(path))
    permission = 'LOAN_CREATE';
  else if (req.method === 'GET') {
    if (path === '/api/my-requests') permission = 'LOAN_VIEW_OWN';
    else if (path === '/api/loan-catalog' || path === '/api/ready-to-borrow')
      permission = 'LOAN_CREATE';
    else if (path === '/api/return-catalog') permission = 'RETURN_CREATE';
    else if (path === '/api/loans') permission = 'LOAN_VIEW_ALL';
    else permission = 'ASSET_VIEW';
  } else if (path === '/api/loans' && req.method === 'POST') permission = 'LOAN_CREATE';
  else if (path === '/api/returns' && req.method === 'POST') permission = 'RETURN_CREATE';
  else permission = 'ASSET_EDIT';
  if (!hasPermission(req.user, permission))
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
  next();
}
