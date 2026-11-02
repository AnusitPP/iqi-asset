import {
  readyToBorrowData,
  borrowedAssetCatalogData,
} from '../../../../shared/features/catalog/parser.js';
export function registerCatalogRoutes(app, { service }) {
  app.get('/api/loan-catalog', async (req, res, next) => {
    try {
      res.json(readyToBorrowData(await service.adapter.readReadyToBorrow()));
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/return-catalog', async (req, res, next) => {
    try {
      res.json(borrowedAssetCatalogData(await service.adapter.readBorrowedAssets()));
    } catch (error) {
      next(error);
    }
  });
}
