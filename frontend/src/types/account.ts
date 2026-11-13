import { z } from 'zod';
import { permissionsForRole } from '@shared/features/auth/permissions.js';

export const roleSchema = z.enum(['STAFF', 'ADMIN', 'SUPER_ADMIN']);
export const userStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar_url: z.string().optional().default(''),
  role: roleSchema,
  status: userStatusSchema,
  permissions: z.array(z.string()),
  created_at: z.string().optional().default(''),
  updated_at: z.string().optional().default(''),
  last_login_at: z.string().optional().default(''),
  last_seen_at: z.string().optional(),
});
export type AccountUser = z.infer<typeof userSchema>;
export type AccountRole = z.infer<typeof roleSchema>;
export type AccountStatus = z.infer<typeof userStatusSchema>;
export const usersSchema = z.object({ records: z.array(userSchema) });
export const userDetailSchema = z.object({ user: userSchema });
export const auditEntrySchema = z.object({
  id: z.string(),
  actor_user_id: z.string(),
  actor_name_snapshot: z.string(),
  actor_email_snapshot: z.string(),
  actor_avatar_url: z.string().optional().default(''),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  before_data: z.string(),
  after_data: z.string(),
  created_at: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export const auditSchema = z.object({ records: z.array(auditEntrySchema) });
export const myRequestsSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      loanId: z.string().optional().default(''),
      itemId: z.string().optional().default(''),
      asset: z.string().optional().default(''),
      name: z.string().optional().default(''),
      date: z.string().optional().default(''),
      status: z.string().optional().default(''),
      serial: z.string().optional().default(''),
      due: z.string().optional().default(''),
      purpose: z.string().optional().default(''),
      notes: z.string().optional().default(''),
      adminComment: z.string().optional().default(''),
      pickupDate: z.string().optional().default(''),
      pickupTime: z.string().optional().default(''),
      team: z.string().optional().default(''),
      borrower: z.string().optional().default(''),
      borrowerNickname: z.string().optional().default(''),
      photo: z.string().optional().default(''),
      completed: z.boolean().optional().default(false),
      statusLocked: z.boolean().optional().default(false),
      order: z.number().optional().default(0),
    }),
  ),
});

export function canAccess(user: AccountUser | null | undefined, permission: string) {
  if (!user) return false;
  const rolePermissions = permissionsForRole(user.role);
  return (
    (rolePermissions.includes('*') || rolePermissions.includes(permission)) &&
    (user.permissions.includes('*') || user.permissions.includes(permission))
  );
}
export function defaultWorkspacePath(user: AccountUser | null | undefined) {
  return canAccess(user, 'ADMIN_DASHBOARD_VIEW') ? '/dashboard' : '/loans';
}
