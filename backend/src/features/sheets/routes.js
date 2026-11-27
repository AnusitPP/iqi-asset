import { excelExport } from './excel.js';
import { requirePermission } from '../auth/middleware/require-permission.js';

const reportFields = {
  assetNumber: 'เลขครุภัณฑ์',
  serial: 'S/N',
  name: 'ชื่ออุปกรณ์',
  condition: 'สภาพ',
  location: 'ที่ตั้ง',
  cost: 'ราคาทุน',
  updatedAt: 'วันที่อัปเดตล่าสุด',
  photos: 'รูป (ลิงก์)',
  holder: 'ชื่อผู้ถือครอง',
};

function reportEntry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const values = {};
  for (const [key, header] of Object.entries(reportFields)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > (key === 'photos' ? 4000 : 300)) return null;
    values[header] = value.trim();
  }
  if (!values['เลขครุภัณฑ์'] || !values['ชื่ออุปกรณ์']) return null;
  const cost = values['ราคาทุน'];
  if (cost) {
    if (!/^\d+(\.\d{1,2})?$/.test(cost) || Number(cost) > Number.MAX_SAFE_INTEGER / 100)
      return null;
    values['ราคาทุน'] = Number(cost);
  }
  const timestamp = values['วันที่อัปเดตล่าสุด'];
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(timestamp)) return null;
  const fullTime = timestamp.length === 16 ? timestamp + ':00' : timestamp;
  const date = new Date(fullTime + 'Z');
  if (Number.isNaN(date.valueOf()) || !date.toISOString().startsWith(fullTime + '.')) return null;
  const [year, month, day] = fullTime.slice(0, 10).split('-');
  values['วันที่อัปเดตล่าสุด'] =
    `${day}/${month}/${String(Number(year) + 543).slice(-2)} ${fullTime.slice(11)}`;
  const photos = values['รูป (ลิงก์)'];
  if (photos) {
    const links = photos
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean);
    for (const link of links) {
      if (!URL.canParse(link) || !['https:', 'http:'].includes(new URL(link).protocol)) return null;
    }
    values['รูป (ลิงก์)'] = links.join('\n');
  }
  return values;
}
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
  app.post(
    '/api/sheets/asset-report/trash',
    requirePermission('SHEETS_VIEW', 'SHEETS_TRASH'),
    async (req, res, next) => {
      const { row, values } = req.body ?? {};
      if (
        !Number.isSafeInteger(row) ||
        row < 2 ||
        !Array.isArray(values) ||
        values.some((value) => typeof value !== 'string') ||
        !values.some((value) => value.trim())
      )
        return res.status(400).json({ error: 'ข้อมูลรายการที่จะย้ายไม่ถูกต้อง' });
      try {
        await adapter.trashAssetReportEntry(row, values);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    '/api/sheets/asset-report',
    requirePermission('SHEETS_VIEW', 'SHEETS_ADD'),
    async (req, res, next) => {
      const values = reportEntry(req.body);
      if (!values)
        return res
          .status(400)
          .json({ error: 'กรุณาตรวจเลขครุภัณฑ์ ชื่อ วันที่ ราคาทุน และลิงก์รูป' });
      try {
        await adapter.appendAssetReportEntry(values);
        res.status(201).json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );
  app.get('/api/sheets/asset-report', requirePermission('SHEETS_VIEW'), async (req, res, next) => {
    try {
      const rows = await adapter.readAssetReportExport();
      res.set('Cache-Control', 'no-store');
      res.json({ rows });
    } catch (error) {
      next(error);
    }
  });
  app.get(
    '/api/sheets/asset-report/export',
    requirePermission('SHEETS_VIEW', 'SHEETS_EXPORT'),
    async (req, res, next) => {
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
    },
  );
}
