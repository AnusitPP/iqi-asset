import { dashboardData } from './data.js';
export function registerDashboardRoutes(app, { dashboardEditor, service }) {
  app.get('/api/dashboard/from-iqi', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.findIqiAsset(req.query.asset));
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/dashboard', async (req, res, next) => {
    try {
      res.json(dashboardData(await service.adapter.readDashboard()));
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/dashboard/from-iqi', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.addFromIqi(req.body?.asset, req.body?.row));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/dashboard/:row/status', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.save(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/dashboard/:row/details', async (req, res, next) => {
    try {
      res.json(await dashboardEditor.saveDetails(Number(req.params.row), req.body || {}));
    } catch (e) {
      next(e);
    }
  });
}
