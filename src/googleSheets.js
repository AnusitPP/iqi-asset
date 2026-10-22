import { google } from 'googleapis';
import { parseSheet, columnName } from './searchService.js';
import { readDropdowns } from './dropdowns.js';
import { SEARCH_STATUS_HEADER, PENDING_STATUS } from './searchStatus.js';
import { ReviewQueue } from './reviewQueue.js';
import { ReviewQueues, IQI_IT_SHEET } from './reviewQueues.js';
import { DASHBOARD_DATE_HEADER } from './dashboard.js';
const quote = (name) => `'${name.replaceAll("'", "''")}'`;
export class GoogleSheets {
  constructor(config) {
    this.config = config;
    const auth = new google.auth.GoogleAuth({
      keyFile: config.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.api = google.sheets({ version: 'v4', auth });
    this.reviewQueue = new ReviewQueue(this);
    this.iqiItQueue = new ReviewQueue(this, IQI_IT_SHEET);
    this.reviewQueues = new ReviewQueues(this, [this.reviewQueue, this.iqiItQueue]);
  }
  async initialize() {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const names = data.sheets.map((s) => s.properties.title);
    const missing = this.config.sheets.filter((s) => !names.includes(s));
    if (missing.length)
      throw Object.assign(new Error(`ไม่พบ Sheet: ${missing.join(', ')}`), { status: 422 });
  }
  async read(names = this.config.sheets) {
    if (names.some((n) => !this.config.sheets.includes(n)))
      throw Object.assign(new Error('ไม่อนุญาตให้อ่าน Sheet นี้'), { status: 403 });
    const ranges = names.map(quote);
    const request = { spreadsheetId: this.config.spreadsheetId, ranges };
    const [formatted, formulas] = await Promise.all([
      this.api.spreadsheets.values.batchGet({ ...request, valueRenderOption: 'FORMATTED_VALUE' }),
      this.api.spreadsheets.values.batchGet({ ...request, valueRenderOption: 'FORMULA' }),
    ]);
    return names.map((name, i) =>
      parseSheet(
        name,
        formatted.data.valueRanges[i].values || [],
        formulas.data.valueRanges[i].values || [],
      ),
    );
  }
  async ensureSearchStatusColumn() {
    const sheet = this.config.sheets[0];
    const [metadata, response] = await Promise.all([
      this.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'sheets.properties',
      }),
      this.api.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: quote(sheet),
        valueRenderOption: 'FORMULA',
      }),
    ]);
    const table = parseSheet(sheet, response.data.values || []);
    const existing = table.headers.filter((h) => h.trim() === SEARCH_STATUS_HEADER);
    if (existing.length > 1)
      throw Object.assign(new Error(`พบคอลัมน์ ${SEARCH_STATUS_HEADER} ซ้ำ กรุณาตรวจสอบ IQI`), {
        status: 422,
      });
    if (existing.length) return false;
    const properties = metadata.data.sheets.find((s) => s.properties.title === sheet)?.properties;
    if (!properties) throw new Error('ไม่พบ IQI');
    const column = table.headers.length;
    const sheetId = properties.sheetId;
    const requests = [];
    if (column >= properties.gridProperties.columnCount)
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: column - properties.gridProperties.columnCount + 1,
        },
      });
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: table.headerRow - 1, columnIndex: column },
        rows: [{ values: [{ userEnteredValue: { stringValue: SEARCH_STATUS_HEADER } }] }],
        fields: 'userEnteredValue',
      },
    });
    if (properties.gridProperties.rowCount > table.headerRow)
      requests.push({
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: table.headerRow,
            endRowIndex: properties.gridProperties.rowCount,
            startColumnIndex: column,
            endColumnIndex: column + 1,
          },
          rule: {
            condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: PENDING_STATUS }] },
            strict: true,
            showCustomUi: true,
          },
        },
      });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
    const [fresh] = await this.read([sheet]);
    if (fresh.headers[column] !== SEARCH_STATUS_HEADER)
      throw new Error('ยืนยันคอลัมน์สถานะการค้นหาไม่ได้');
    return true;
  }
  async getDropdowns(sheet, row, width) {
    if (sheet !== this.config.sheets[0])
      throw Object.assign(new Error('อ่านตัวเลือกแก้ไขได้เฉพาะ IQI'), { status: 403 });
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      ranges: [`${quote(sheet)}!A${row}:${columnName(width - 1)}${row}`],
      includeGridData: true,
      fields: 'sheets(data(startColumn,rowData(values(dataValidation))))',
    });
    const cells = Array.from({ length: width }, () => ({}));
    for (const grid of data.sheets?.[0]?.data || [])
      for (const [i, cell] of (grid.rowData?.[0]?.values || []).entries())
        cells[(grid.startColumn || 0) + i] = cell;
    return readDropdowns(cells, width, async (range) => {
      const response = await this.api.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      return response.data.values || [];
    });
  }
  async ensureReviewSheet() {
    const first = await this.reviewQueue.ensure();
    const second = await this.iqiItQueue.ensure();
    return first || second;
  }
  async readReviewQueue() {
    return this.reviewQueue.read();
  }
  async readDashboard() {
    return (
      (
        await this.api.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: "'Appscriptdata'!A1:AZ5000",
          valueRenderOption: 'FORMATTED_VALUE',
        })
      ).data.values || []
    );
  }
  async writeDashboardPhotos(row, links, date) {
    const values = await this.readDashboard(),
      headers = values[0] || [];
    const metadata = (
      await this.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'sheets.properties',
      })
    ).data;
    const p = metadata.sheets.find((s) => s.properties.title === 'Appscriptdata')?.properties;
    if (!p) throw new Error('ไม่พบ Appscriptdata');
    let next = Math.max(...values.map((r) => r.length));
    const requests = [];
    const cell = (r, c, v) => ({
      updateCells: {
        range: {
          sheetId: p.sheetId,
          startRowIndex: r,
          endRowIndex: r + 1,
          startColumnIndex: c,
          endColumnIndex: c + 1,
        },
        rows: [{ values: [{ userEnteredValue: { stringValue: v } }] }],
        fields: 'userEnteredValue',
      },
    });
    for (const [name, value] of [
      ['ลิงก์รูปครุภัณฑ์', links],
      ['วันที่อัปโหลดรูป', date],
    ]) {
      let c = headers.indexOf(name);
      if (c < 0) {
        c = next++;
        requests.push(cell(0, c, name), {
          updateDimensionProperties: {
            range: { sheetId: p.sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
            properties: { pixelSize: 220 },
            fields: 'pixelSize',
          },
        });
      }
      requests.push(cell(row - 1, c, value));
    }
    if (next > p.gridProperties.columnCount)
      requests.unshift({
        appendDimension: {
          sheetId: p.sheetId,
          dimension: 'COLUMNS',
          length: next - p.gridProperties.columnCount,
        },
      });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
  }
  async writeDashboardStatus(row, statusColumn, dateColumn, status, date, addHeader) {
    const metadata = (
      await this.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'sheets.properties',
      })
    ).data;
    const properties = metadata.sheets.find(
      (s) => s.properties.title === 'Appscriptdata',
    )?.properties;
    if (!properties) throw Object.assign(new Error('ไม่พบ Appscriptdata'), { status: 404 });
    const sheetId = properties.sheetId,
      requests = [];
    if (dateColumn >= properties.gridProperties.columnCount)
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: dateColumn - properties.gridProperties.columnCount + 1,
        },
      });
    const cell = (r, c, value) => ({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: r,
          endRowIndex: r + 1,
          startColumnIndex: c,
          endColumnIndex: c + 1,
        },
        rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
        fields: 'userEnteredValue',
      },
    });
    if (addHeader) {
      requests.push(cell(0, dateColumn, DASHBOARD_DATE_HEADER));
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: dateColumn,
            endIndex: dateColumn + 1,
          },
          properties: { pixelSize: 190 },
          fields: 'pixelSize',
        },
      });
    }
    requests.push(cell(row - 1, statusColumn, status), cell(row - 1, dateColumn, date));
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
  }
  async readReviewQueues() {
    return this.reviewQueues.read();
  }
  async setReviewSelection(table, record, pending) {
    return this.reviewQueues.setSelection(table, record, pending);
  }
  async writeIQIAndReview(table, record, changes) {
    return this.reviewQueues.applyChanges(table, record, changes);
  }
  async reviewInspection(table, record, update) {
    return this.reviewQueues.inspection(table, record, update);
  }
  async writeIQI(row, changes) {
    // The target sheet comes exclusively from server configuration, never request data.
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: changes.map(({ index, value }) => ({
          range: `${quote(this.config.sheets[0])}!${columnName(index)}${row}`,
          values: [[value]],
        })),
      },
    });
  }
}
