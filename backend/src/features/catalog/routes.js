import { borrowedAssetCatalogData } from '../../../../shared/features/catalog/parser.js';
export function registerCatalogRoutes(app, { service, lendingLedger }) {
  app.get('/api/loan-catalog', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/return-catalog', async (req, res, next) => {
    try {
      if (req.user) {
        const [state, tables] = await Promise.all([
          lendingLedger.readLedger(),
          req.authStorage.read(),
        ]);
        const own = new Set(
          tables.AuditLogs.filter(
            (entry) => entry.actor_user_id === req.user.id && entry.action === 'LOAN_CREATED',
          ).map((entry) => entry.entity_id),
        );
        return res.json({
          records: state.active
            .filter(
              (row) =>
                own.has(row[0]) &&
                row[14] === 'กำลังยืม' &&
                !state.returns.some((returned) => returned[2] === row[1]),
            )
            .map((row, index) => ({
              row: index + 2,
              asset: row[7],
              serial: row[8] || '',
              name: row[9] || '',
              team: row[4] || '',
            })),
        });
      }
      res.json(borrowedAssetCatalogData(await service.adapter.readBorrowedAssets()));
    } catch (error) {
      next(error);
    }
  });
}
