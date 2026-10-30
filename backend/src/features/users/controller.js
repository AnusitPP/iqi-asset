import { UserManagementService } from './service.js';
export function userManagementController(config) {
  const service = (req) => new UserManagementService(req.authStorage, config);
  return {
    list: async (req, res) => res.json({ records: await service(req).list(req.query) }),
    detail: async (req, res) => res.json({ user: await service(req).detail(req.params.id) }),
    role: async (req, res) =>
      res.json({
        user: await service(req).update(req.user, req.params.id, 'role', req.body?.role),
      }),
    status: async (req, res) =>
      res.json({
        user: await service(req).update(req.user, req.params.id, 'status', req.body?.status),
      }),
  };
}
