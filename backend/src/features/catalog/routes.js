import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
export function registerCatalogRoutes(app, { lendingLedger }) {
  app.get('/api/loan-catalog', async (req, res, next) => {
    try {
      res.json(await lendingLedger.readAvailableAssets());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/return-catalog', async (req, res, next) => {
    try {
      const [state, tables] = await Promise.all([
        lendingLedger.readLedger(),
        req.authStorage.read(),
      ]);
      const own = new Set(
        tables.AuditLogs.filter(
          (entry) => entry.actor_user_id === req.user.id && entry.action === 'LOAN_CREATED',
        ).map((entry) => entry.entity_id),
      );
      const catalog = lendingLedger.adapter?.readReadyToBorrow
        ? readyToBorrowData(await lendingLedger.adapter.readReadyToBorrow()).records
        : [];
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
            loanId: row[0],
            start: row[11] || '',
            due: row[12] || '',
            status: row[14] || '',
            borrower: row[3] || '',
            purpose: row[10] || '',
            notes: row[13] || '',
            adminComment: row[19] || '',
            photo:
              catalog.find((record) => record.asset === row[7] && record.serial === (row[8] || ''))
                ?.photo || '',
          })),
      });
    } catch (error) {
      next(error);
    }
  });
}
