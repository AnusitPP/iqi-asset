import { hasPermission } from '../../../../shared/features/auth/permissions.js';
export function registerRecordsRoutes(app, { service }) {
  app.get('/api/search', async (req, res, next) => {
    try {
      if (req.query.pendingOnly !== undefined && !['0', '1'].includes(req.query.pendingOnly))
        return res.status(400).json({ error: 'ตัวกรองไม่ถูกต้อง' });
      const result = await service.search(req.query.q ?? '', { pendingOnly: req.query.pendingOnly === '1' });
      if (req.user && !hasPermission(req.user,'ASSET_EDIT')) {
        for (const group of result.groups || []) group.editable = false;
      }
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/record', async (req, res, next) => {
    try {
      const detail = await service.detail(req.query.sheet, Number(req.query.row));
      if (req.user && !hasPermission(req.user,'ASSET_EDIT')) detail.editable = false;
      res.json(detail);
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/iqi/:row', async (req, res, next) => {
    try {
      res.json(await service.save(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/iqi/:row/search-status', async (req, res, next) => {
    try {
      res.json(await service.setPending(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
}
