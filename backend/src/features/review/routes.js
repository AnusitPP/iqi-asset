export function registerReviewRoutes(app, { service }) {
  app.put('/api/review-selection', async (req, res, next) => {
    try {
      const body = req.body || {};
      res.json(await service.setReviewPending(body.sheet, Number(body.row), body));
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/review-inspection', async (req, res, next) => {
    try {
      res.json(await service.reviewInspection(req.query.sheet, Number(req.query.row), req.query));
    } catch (e) {
      next(e);
    }
  });
  app.put('/api/review-inspection', async (req, res, next) => {
    try {
      const body = req.body || {};
      res.json(await service.reviewInspection(body.sheet, Number(body.row), body, true));
    } catch (e) {
      next(e);
    }
  });
}
