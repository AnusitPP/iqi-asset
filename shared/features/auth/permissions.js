export const ROLES = Object.freeze(['STAFF', 'ADMIN', 'SUPER_ADMIN']);
export const USER_STATUSES = Object.freeze(['ACTIVE', 'DISABLED']);
const STAFF = ['LOAN_CREATE', 'LOAN_VIEW_OWN', 'RETURN_CREATE'];
export const ADMIN_ACCESS_GROUPS = [
  {
    page: 'SHEETS_VIEW',
    label: 'ไฟล์ Google Sheets',
    actions: [
      { id: 'SHEETS_EXPORT', label: 'ส่งออก CSV / Excel' },
      { id: 'SHEETS_ADD', label: 'เพิ่มรายการ' },
      { id: 'SHEETS_TRASH', label: 'ย้ายรายการไปถังขยะ' },
    ],
  },
  {
    page: 'LOAN_VIEW_ALL',
    label: 'คำขออนุมัติ',
    actions: [
      { id: 'LOAN_APPROVE', label: 'อนุมัติและอัปเดตสถานะ' },
      { id: 'LOAN_REJECT', label: 'ปฏิเสธคำขอ' },
      { id: 'RESPONSIBLE_ASSIGN', label: 'บันทึกชื่อผู้ดำเนินการเป็นผู้รับผิดชอบ' },
    ],
  },
  { page: 'MAIL_VIEW', label: 'ส่งอีเมล', actions: [{ id: 'MAIL_SEND', label: 'ส่งอีเมล' }] },
  { page: 'USER_VIEW', label: 'ผู้ใช้งาน', actions: [] },
];
const adminActions = new Set(
  ADMIN_ACCESS_GROUPS.flatMap(({ page, actions }) => [page, ...actions.map(({ id }) => id)]),
);
export function adminAccessList(value) {
  if (!Array.isArray(value) || value.some((permission) => !adminActions.has(permission)))
    return null;
  const selected = new Set(value);
  return ADMIN_ACCESS_GROUPS.flatMap(({ page, actions }) =>
    selected.has(page)
      ? [page, ...actions.map(({ id }) => id).filter((id) => selected.has(id))]
      : [],
  );
}
export function approvalPermission(status) {
  return status === 'ไม่อนุมัติ' ? 'LOAN_REJECT' : 'LOAN_APPROVE';
}
const ADMIN = [
  ...STAFF,
  'PORTAL_HOME_VIEW',
  'ASSET_VIEW',
  'ASSET_EDIT',
  'SHEETS_VIEW',
  'SHEETS_EXPORT',
  'MAIL_VIEW',
  'MAIL_SEND',
  'LOAN_VIEW_ALL',
  'LOAN_APPROVE',
  'LOAN_REJECT',
  'RESPONSIBLE_ASSIGN',
  'RETURN_ACCEPT',
  'USER_VIEW',
];
const ROLE_PERMISSIONS = Object.freeze({ STAFF, ADMIN, SUPER_ADMIN: ['*'] });
export function permissionsForRole(role, includeOptional = false) {
  return role === 'ADMIN' && includeOptional
    ? [...new Set([...ADMIN, ...adminActions])]
    : [...(ROLE_PERMISSIONS[role] || [])];
}
export function adminPermissions(assignments) {
  const defaults = ADMIN.filter((permission) => adminActions.has(permission));
  const selections = assignments.map(({ permissions }) => {
    if (!permissions) return defaults;
    try {
      return adminAccessList(JSON.parse(permissions)) ?? [];
    } catch {
      return [];
    }
  });
  return permissionsForRole('ADMIN', true).filter(
    (permission) =>
      !adminActions.has(permission) ||
      selections.every((selection) => selection.includes(permission)),
  );
}
export function hasPermission(user, permission) {
  const permissions = user?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}
