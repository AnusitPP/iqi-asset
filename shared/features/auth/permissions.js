export const ROLES = Object.freeze(['STAFF', 'ADMIN', 'SUPER_ADMIN']);
export const USER_STATUSES = Object.freeze(['ACTIVE', 'DISABLED']);
const STAFF = ['ASSET_VIEW', 'LOAN_CREATE', 'LOAN_VIEW_OWN', 'RETURN_CREATE'];
const ADMIN = [...STAFF, 'ASSET_EDIT', 'ADMIN_DASHBOARD_VIEW', 'LOAN_VIEW_ALL',
  'LOAN_APPROVE', 'LOAN_REJECT', 'RESPONSIBLE_ASSIGN', 'RETURN_ACCEPT', 'AUDIT_VIEW'];
const ROLE_PERMISSIONS = Object.freeze({ STAFF, ADMIN, SUPER_ADMIN: ['*'] });
export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}
export function hasPermission(user, permission) {
  const permissions = user?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}
