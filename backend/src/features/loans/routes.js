export function registerLoansRoutes(app, { lendingLedger, loanRequests }) {
  app.get('/api/ready-to-borrow', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/loans', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readOutstandingLoans());
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/loans', async (req, res, next) => {
    try {
      res.json(await loanRequests.submit(req.body || {}));
    } catch (error) {
      next(error);
    }
  });
}
