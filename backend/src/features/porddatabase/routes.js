import { PordDatabase } from './service.js';
export function registerPordDatabaseRoutes(app, { adapter, photoStore }) {
  const service = new PordDatabase(adapter, photoStore);
  app.use('/api/porddatabase', (req, res, next) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role))
      return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้น' });
    next();
  });
  app.get('/api/porddatabase', async (req, res, next) => {
    try {
      res.json(await service.read());
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/porddatabase', async (req, res, next) => {
    try {
      res.json(await service.send(req.body));
    } catch (error) {
      next(error);
    }
  });
}
