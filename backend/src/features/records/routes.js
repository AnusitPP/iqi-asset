export function registerRecordsRoutes(app, { service }) {
  app.get('/api/search', async (req, res, next) => {
    try {
      if (req.query.pendingOnly !== undefined && !['0', '1'].includes(req.query.pendingOnly))
        return res.status(400).json({ error: 'ตัวกรองไม่ถูกต้อง' });
      res.json(
        await service.search(req.query.q ?? '', { pendingOnly: req.query.pendingOnly === '1' }),
      );
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/record', async (req, res, next) => {
    try {
      res.json(await service.detail(req.query.sheet, Number(req.query.row)));
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
