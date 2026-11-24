import ExcelJS from 'exceljs';
import { excelExport } from '../../backend/src/features/sheets/excel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/http/app.js';
import { testSession } from '../helpers/session.js';
import { csvExport } from '../../backend/src/features/sheets/routes.js';
import { GoogleSheets } from '../../backend/src/integrations/google/googleSheets.js';

test('CSV preserves Thai, quotes, newlines and empty columns with BOM and neutralizes formulas', () => {
  assert.equal(
    csvExport([
      ['ชื่อ', 'รายละเอียด', 'ว่าง'],
      ['ก,ข', '"จอ"\nสองบรรทัด'],
      ['=HYPERLINK("x")', '@SUM(1)', ' +1'],
    ]),
    '\uFEFF"ชื่อ","รายละเอียด","ว่าง"\r\n"ก,ข","""จอ""\nสองบรรทัด",""\r\n"\'=HYPERLINK(""x"")","\'@SUM(1)","\' +1"\r\n',
  );
  assert.equal(csvExport([]), '\uFEFF');
});

test('PORD export reads only existing รายงานครุภัณฑ์ ปี 70 and never creates it', async () => {
  let exists = false;
  const requests = [];
  const adapter = new GoogleSheets({ keyFile: 'unused', spreadsheetId: 'test' });
  adapter.api = {
    spreadsheets: {
      get: async () => ({
        data: { sheets: exists ? [{ properties: { title: 'รายงานครุภัณฑ์ ปี 70' } }] : [] },
      }),
      values: {
        get: async (request) => {
          requests.push(request);
          return { data: { values: [['ชื่อ'], ['ภาษาไทย']] } };
        },
      },
    },
  };
  await assert.rejects(adapter.readAssetReportExport(), { status: 404 });
  assert.equal(requests.length, 0);
  exists = true;
  assert.deepEqual(await adapter.readAssetReportExport(), [['ชื่อ'], ['ภาษาไทย']]);
  assert.equal(requests[0].range, "'รายงานครุภัณฑ์ ปี 70'");
  assert.equal(requests[0].valueRenderOption, 'FORMATTED_VALUE');
});

test('export requires admin, validates format, returns current CSV and propagates read failures', async (t) => {
  const fixture = await testSession({ host: '127.0.0.1' });
  let reads = 0;
  let fail = false;
  const adapter = {
    readAssetReportExport: async () => {
      reads++;
      if (fail) throw Object.assign(new Error('ไม่พบชีต รายงานครุภัณฑ์ ปี 70'), { status: 404 });
      return [['ชื่อ'], ['ไทย']];
    },
  };
  const server = createApp({ adapter }, fixture.config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const reportUrl = `http://127.0.0.1:${server.address().port}/api/sheets/asset-report`;
  const base = reportUrl + '/export';
  const headers = { Cookie: fixture.cookie };
  assert.equal((await fetch(base + '?format=csv')).status, 401);
  const staff = await fixture.sessions.login({
    sub: 'staff',
    email: 'staff@example.invalid',
    name: 'Staff',
  });
  assert.equal(
    (await fetch(base + '?format=csv', { headers: { Cookie: `iqi_session=${staff}` } })).status,
    403,
  );
  assert.equal((await fetch(base + '?format=pdf', { headers })).status, 400);
  assert.equal(reads, 0);
  assert.equal((await fetch(reportUrl)).status, 401);
  assert.equal(
    (await fetch(reportUrl, { headers: { Cookie: `iqi_session=${staff}` } })).status,
    403,
  );
  const preview = await fetch(reportUrl, { headers });
  assert.equal(preview.status, 200);
  assert.deepEqual((await preview.json()).rows, [['ชื่อ'], ['ไทย']]);
  const response = await fetch(base + '?format=csv', { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.equal(data.filename, 'รายงานครุภัณฑ์ ปี 70.csv');
  assert.equal(data.content, '\uFEFF"ชื่อ"\r\n"ไทย"\r\n');
  const excelResponse = await fetch(base + '?format=xlsx', { headers });
  assert.equal(excelResponse.status, 200);
  const excelData = await excelResponse.json();
  assert.equal(excelData.filename, 'รายงานครุภัณฑ์ ปี 70.xlsx');
  assert.equal(Buffer.from(excelData.content, 'base64').subarray(0, 2).toString(), 'PK');
  fail = true;
  assert.equal((await fetch(base + '?format=csv', { headers })).status, 404);
});

test('Excel export keeps IDs and Thai dates as text, formats costs and separates every photo link', async () => {
  const rows = [
    [
      'เลขครุภัณฑ์',
      'S/N',
      'ชื่ออุปกรณ์',
      'สภาพ',
      'ที่ตั้ง',
      'ราคาทุน',
      'วันที่อัปเดตล่าสุด',
      'รูป (ลิงก์)',
      'ชื่อผู้ถือครอง',
    ],
    [
      '001',
      '0000123',
      '=literal',
      'ดี',
      '',
      '26,500.00',
      '16/11/69 15:26:44',
      'https://example.com/1\nhttps://example.com/2\nhttps://example.com/3',
      'ผู้ถือครอง',
    ],
  ];
  const before = structuredClone(rows);
  const bytes = await excelExport(rows);
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet = book.getWorksheet('รายงานครุภัณฑ์ ปี 70');
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.columnCount, 11);
  assert.equal(sheet.getCell('A2').value, '001');
  assert.equal(sheet.getCell('B2').value, '0000123');
  assert.equal(sheet.getCell('C2').value, '=literal');
  assert.equal(sheet.getCell('F2').value, 26500);
  assert.equal(sheet.getCell('F2').numFmt, '#,##0.00');
  assert.equal(sheet.getCell('G2').value, '16/11/69 15:26:44');
  assert.equal(sheet.getCell('G2').numFmt, '@');
  assert.equal(sheet.getCell('H2').value.hyperlink, 'https://example.com/1');
  assert.equal(sheet.getCell('J2').value.hyperlink, 'https://example.com/3');
  assert.equal(sheet.getCell('K2').value, 'ผู้ถือครอง');
  assert.equal(sheet.getRow(2).height, 30);
  assert.equal(sheet.views[0].ySplit, 1);
  assert(sheet.autoFilter);
  assert.deepEqual(rows, before);
});
