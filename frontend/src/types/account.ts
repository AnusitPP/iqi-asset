import { z } from 'zod';

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
      asset: z.string().optional().default(''),
      name: z.string().optional().default(''),
      date: z.string().optional().default(''),
      status: z.string().optional().default(''),
    }),
  ),
});

export function canAccess(user: AccountUser | null | undefined, permission: string) {
  return (
    user?.permissions.includes('*') === true || user?.permissions.includes(permission) === true
  );
}
export function defaultWorkspacePath(user: AccountUser | null | undefined) {
  return canAccess(user, 'ADMIN_DASHBOARD_VIEW') ? '/dashboard' : '/assets';
}
