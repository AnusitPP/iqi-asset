import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { loanColumnMapping } from '../../core/lending/schema.js';
import { google } from 'googleapis';
import { parseSheet, columnName } from '../../features/records/search.js';
import { readDropdowns } from '../../features/records/dropdowns.js';
import {
  SEARCH_STATUS_HEADER,
  PENDING_STATUS,
} from '../../../../shared/features/records/searchStatus.js';
import { ReviewQueue } from '../../features/review/queue.js';
import { ReviewQueues, IQI_IT_SHEET } from '../../features/review/queues.js';
import { DASHBOARD_DATE_HEADER } from '../../features/dashboard/editor.js';
const quote = (name) => `'${name.replaceAll("'", "''")}'`;
export class GoogleSheets {
  constructor(config) {
    this.config = config;
    const auth = new google.auth.GoogleAuth({
      ...(config.serviceAccount
        ? { credentials: config.serviceAccount }
        : { keyFile: config.keyFile }),
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
  async appendDashboardRow(row) {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const sheet = data.sheets.find((s) => s.properties.title === 'Appscriptdata')?.properties;
    if (!sheet) throw Object.assign(new Error('ไม่พบ Appscriptdata'), { status: 404 });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        requests: [
          {
            appendCells: {
              sheetId: sheet.sheetId,
              rows: [
                { values: row.map((value) => ({ userEnteredValue: { stringValue: value } })) },
              ],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });
  }
  async readReadyToBorrow() {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: "'พร้อมยืม'!A:E",
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return data.values || [];
  }
  async readBorrowedAssets() {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: "'รายการยืมครุภัณฑ์'!A:T",
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return data.values || [];
  }
  async readLoanSheets() {
    const { data } = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.config.spreadsheetId,
      ranges: ["'รายการยืมครุภัณฑ์'!A:T", "'รายการคืนครุภัณฑ์'!A:S"],
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return { loans: data.valueRanges[0].values || [], returns: data.valueRanges[1].values || [] };
  }
  async updateReturnStatus(id, status, responsible, condition) {
    const grid = await this.readLoanSheets();
    const matches = grid.returns.flatMap((row, index) => (row[0] === id ? [index] : []));
    if (matches.length !== 1 || matches[0] < 1)
      throw Object.assign(new Error('ไม่พบรายการคืนหรือรหัสซ้ำ'), { status: 409 });
    const index = matches[0];
    const updates = [
      {
        range: `'รายการคืนครุภัณฑ์'!N${index + 1}:P${index + 1}`,
        values: [[condition || grid.returns[index][13] || '', status, responsible]],
      },
    ];
    if (status === 'เสร็จสิ้น') {
      const { indices } = loanColumnMapping(grid.loans[0]);
      const loans = grid.loans.flatMap((row, i) =>
        i > 0 &&
        row[indices[0]] === grid.returns[index][1] &&
        row[indices[1]] === grid.returns[index][2]
          ? [i]
          : [],
      );
      if (loans.length !== 1 || loans[0] < 1)
        throw Object.assign(new Error('ไม่พบรายการยืมที่เชื่อมกับคำขอคืน'), { status: 409 });
      updates.push({
        range: `'รายการยืมครุภัณฑ์'!${columnName(indices[14])}${loans[0] + 1}`,
        values: [['เสร็จสิ้น']],
      });
    }
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });
  }
  async updateLoanStatus(id, status, responsible) {
    const data = await this.readLoanSheets();
    const { indices } = loanColumnMapping(data.loans[0]);
    const indexes = data.loans.flatMap((row, index) =>
      index > 0 && row[indices[0]] === id ? [index + 1] : [],
    );
    if (indexes.length !== 1)
      throw Object.assign(new Error('รายการยืมเปลี่ยนไป กรุณาโหลดใหม่'), { status: 409 });
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `'รายการยืมครุภัณฑ์'!${columnName(indices[14])}${indexes[0]}`,
            values: [[status]],
          },
          {
            range: `'รายการยืมครุภัณฑ์'!${columnName(indices[15])}${indexes[0]}`,
            values: [[responsible]],
          },
        ],
      },
    });
  }
  async appendLoanRows(kind, rows, { email = '' } = {}) {
    const title = kind === 'loans' ? 'รายการยืมครุภัณฑ์' : 'รายการคืนครุภัณฑ์';
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const sheetId = data.sheets.find((s) => s.properties.title === title)?.properties.sheetId;
    if (sheetId === undefined) throw new Error('ไม่พบชีต ' + title);
    const statusUpdates = [];
    const grid = (await this.readLoanSheets()).loans;
    const mapping = loanColumnMapping(grid[0]);
    if (kind === 'loans') {
      rows = rows.map((row) => {
        const values = Array(grid[0].length).fill('');
        mapping.indices.forEach((column, index) => {
          values[column] = row[index] ?? '';
        });
        if (mapping.emailIndex >= 0) values[mapping.emailIndex] = email;
        return values;
      });
    }
    if (kind === 'returns') {
      const loanSheet = data.sheets.find((s) => s.properties.title === 'รายการยืมครุภัณฑ์')
        ?.properties.sheetId;
      for (const row of rows.filter(
        (r) =>
          r[2] && [LENDING_STATUS.RETURN_RECEIVED, LENDING_STATUS.RETURN_PENDING].includes(r[14]),
      )) {
        const index = grid.findIndex((r, i) => i > 0 && r[mapping.indices[1]] === row[2]);
        if (index < 1 || loanSheet === undefined) throw new Error('ไม่พบรายการยืมสำหรับรับคืน');
        statusUpdates.push({
          updateCells: {
            start: { sheetId: loanSheet, rowIndex: index, columnIndex: mapping.indices[14] },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {
                      stringValue:
                        row[14] === LENDING_STATUS.RETURN_RECEIVED
                          ? LENDING_STATUS.RETURNED
                          : 'รอดำเนินการคืน',
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue',
          },
        });
      }
    }
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        requests: [
          ...statusUpdates,
          {
            appendCells: {
              sheetId,
              rows: rows.map((row) => ({
                values: row.map((value) => ({ userEnteredValue: { stringValue: String(value) } })),
              })),
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });
  }
  async writeDashboardPhotoSlots(row, urls, date) {
    if (!Array.isArray(urls) || urls.length > 3) throw new Error('จำกัดไม่เกิน 3 รูป');
    const values = await this.readDashboard(),
      headers = values[0] || [];
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const p = data.sheets.find((s) => s.properties.title === 'Appscriptdata')?.properties;
    if (!p) throw new Error('ไม่พบ Appscriptdata');
    const names = ['รูป1', 'รูป2', 'รูป3', 'วันที่อัปโหลดรูป'];
    if (names.some((h) => headers.filter((v) => v === h).length !== 1))
      throw new Error('กรุณาตั้งคอลัมน์ รูป1 รูป2 รูป3 และวันที่อัปโหลดรูป ให้ครบและไม่ซ้ำ');
    const requests = names.map((name, i) => ({
      updateCells: {
        range: {
          sheetId: p.sheetId,
          startRowIndex: row - 1,
          endRowIndex: row,
          startColumnIndex: headers.indexOf(name),
          endColumnIndex: headers.indexOf(name) + 1,
        },
        rows: [{ values: [{ userEnteredValue: { stringValue: i < 3 ? urls[i] || '' : date } }] }],
        fields: 'userEnteredValue',
      },
    }));
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
  async writeDashboardDetails(row, changes) {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const sheet = data.sheets.find((s) => s.properties.title === 'Appscriptdata')?.properties;
    if (!sheet) throw Object.assign(new Error('ไม่พบ Appscriptdata'), { status: 404 });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        requests: changes.map(({ column, value }) => ({
          updateCells: {
            range: {
              sheetId: sheet.sheetId,
              startRowIndex: row - 1,
              endRowIndex: row,
              startColumnIndex: column,
              endColumnIndex: column + 1,
            },
            rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
            fields: 'userEnteredValue',
          },
        })),
      },
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
