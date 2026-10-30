import { userManagementController } from './controller.js';
import { requirePermission } from '../auth/middleware/require-permission.js';
export function registerUserRoutes(app, config) {
  const controller = userManagementController(config);
  app.get('/api/admin/users', requirePermission('USER_VIEW'), controller.list);
  app.get('/api/admin/users/:id', requirePermission('USER_VIEW'), controller.detail);
  app.patch('/api/admin/users/:id/role', requirePermission('USER_MANAGE'), controller.role);
  app.patch('/api/admin/users/:id/status', requirePermission('USER_MANAGE'), controller.status);
}
