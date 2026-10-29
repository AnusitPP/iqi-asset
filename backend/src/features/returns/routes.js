export function registerReturnsRoutes(app, { returnRequests }) {
  app.post('/api/returns', async (req, res, next) => {
    try {
      res.json(await returnRequests.submit(req.body || {}));
    } catch (error) {
      next(error);
    }
  });
}
