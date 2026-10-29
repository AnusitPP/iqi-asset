import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
export function registerCatalogRoutes(app, { service }) {
  app.get('/api/loan-catalog', async (req, res, next) => {
    try {
      res.json(readyToBorrowData(await service.adapter.readReadyToBorrow()));
    } catch (error) {
      next(error);
    }
  });
}
