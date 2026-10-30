import { googleProfileImageUrl } from '../../../../shared/features/auth/profile.js';
import { hasPermission } from '../../../../shared/features/auth/permissions.js';
export function registerAuditRoutes(app) {
  app.get('/api/audit', async (req, res) => {
    const tables = await req.authStorage.read();
    const operational = new Set([
      'LOAN_CREATED',
      'RETURN_CREATED',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'RESPONSIBLE_ASSIGNED',
      'RETURN_ACCEPTED',
    ]);
    const rows = tables.AuditLogs.filter(
      (entry) => hasPermission(req.user, 'USER_MANAGE') || operational.has(entry.action),
    );
    res.json({
      records: rows
        .slice(-200)
        .reverse()
        .map(({ row, ...entry }) => ({
          ...entry,
          actor_avatar_url: googleProfileImageUrl(
            tables.Users.find((user) => user.id === entry.actor_user_id)?.avatar_url,
          ),
        })),
    });
  });
}
