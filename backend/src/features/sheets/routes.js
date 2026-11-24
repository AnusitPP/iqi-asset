import { excelExport } from './excel.js';
export function csvExport(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        Array.from({ length: width }, (_, index) => {
          let value = String(row[index] ?? '');
          // Export text safely when a spreadsheet application would interpret a formula.
          if (/^[\s]*[=+@-]|^[\t\r\n]/u.test(value)) value = "'" + value;
          return '"' + value.replaceAll('"', '""') + '"';
        }).join(','),
      )
      .join('\r\n') +
    (rows.length ? '\r\n' : '')
  );
}

export function registerSheetsRoutes(app, { adapter }) {
  app.get('/api/sheets/asset-report', async (req, res, next) => {
    try {
      const rows = await adapter.readAssetReportExport();
      res.set('Cache-Control', 'no-store');
      res.json({ rows });
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/sheets/asset-report/export', async (req, res, next) => {
    try {
      if (!['csv', 'xlsx'].includes(req.query.format))
        return res.status(400).json({ error: 'รองรับการ Export เป็น CSV หรือ Excel เท่านั้น' });
      const rows = await adapter.readAssetReportExport();
      res.set('Cache-Control', 'no-store');
      const excel = req.query.format === 'xlsx';
      res.json({
        filename: `รายงานครุภัณฑ์ ปี 70.${excel ? 'xlsx' : 'csv'}`,
        content: excel ? (await excelExport(rows)).toString('base64') : csvExport(rows),
      });
    } catch (error) {
      next(error);
    }
  });
}
