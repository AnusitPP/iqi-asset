import { createHash } from 'node:crypto';
import { permissionsForRole } from '../../../../../shared/features/auth/permissions.js';
import { throwHttpError } from '../../../core/errors/errors.js';
const rank = { STAFF: 0, ADMIN: 1, SUPER_ADMIN: 2 };
export const userIdForGoogleSub = (sub) => 'U-' + createHash('sha256').update(sub).digest('hex');
export function soleSuperAdminId(tables) {
  const ids = [
    ...new Set(
      tables.Admins.filter((admin) => admin.assigned_by === 'BOOTSTRAP' && admin.user_id).map(
        (admin) => admin.user_id,
      ),
    ),
  ];
  if (ids.length > 1) throwHttpError(503, 'ข้อมูล SUPER_ADMIN หลักขัดแย้ง กรุณาตรวจชีต Admins');
  return ids[0] || null;
}
export function currentUser(tables, id) {
  const profiles = tables.Users.filter((user) => user.id === id);
  if (!profiles.length) return null;
  const user = profiles.at(-1);
  if (profiles.some((profile) => profile.google_sub !== user.google_sub))
    throwHttpError(503, 'ข้อมูลผู้ใช้ขัดแย้ง กรุณาติดต่อผู้ดูแล');
  const assignments = tables.Admins.filter(
    (admin) => admin.user_id === id && admin.status === 'ACTIVE',
  );
  if (assignments.some((admin) => !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)))
    throwHttpError(503, 'สิทธิ์ผู้ใช้ไม่ถูกต้อง กรุณาติดต่อผู้ดูแล');
  const ownerId = soleSuperAdminId(tables);
  const role = assignments.length
    ? assignments
        .map((admin) => (admin.role === 'SUPER_ADMIN' && id !== ownerId ? 'ADMIN' : admin.role))
        .sort((a, b) => rank[a] - rank[b])[0]
    : 'STAFF';
  return {
    id,
    google_sub: user.google_sub,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    status: profiles.every((profile) => profile.status === 'ACTIVE') ? 'ACTIVE' : 'DISABLED',
    role,
    permissions: permissionsForRole(role),
    last_login_at: user.last_login_at,
    created_at: profiles[0].created_at,
    updated_at: user.updated_at,
  };
}
export function publicUser(user) {
  if (!user) return null;
  const { google_sub, ...profile } = user;
  return profile;
}
