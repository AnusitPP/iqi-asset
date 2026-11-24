import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { loanColumnMapping, LENDING_SHEETS } from '../../core/lending/schema.js';
import { google } from 'googleapis';
import { manageGoogleClient } from './request-manager.js';
import { columnName } from '../../features/records/search.js';
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
    this.api = manageGoogleClient(google.sheets({ version: 'v4', auth }));
  }
  async initialize() {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const names = data.sheets.map((s) => s.properties.title);
    const missing = LENDING_SHEETS.filter((s) => !names.includes(s));
    if (missing.length)
      throw Object.assign(new Error(`ไม่พบ Sheet: ${missing.join(', ')}`), { status: 422 });
  }
  async readAssetReportExport() {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties.title',
    });
    if (!data.sheets.some((sheet) => sheet.properties.title === 'รายงานครุภัณฑ์ ปี 70'))
      throw Object.assign(new Error('ไม่พบชีต รายงานครุภัณฑ์ ปี 70'), { status: 404 });
    const response = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: "'รายงานครุภัณฑ์ ปี 70'",
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return response.data.values || [];
  }
  async readReadyToBorrow() {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: "'พร้อมยืม'!A:AZ",
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return data.values || [];
  }
  async appendReadyToBorrow(row) {
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: "'พร้อมยืม'!A:AZ",
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
  }
  async clearReadyToBorrow(row) {
    if (!Number.isInteger(row) || row < 2)
      throw Object.assign(new Error('ข้อมูลแถวไม่ถูกต้อง'), { status: 400 });
    await this.api.spreadsheets.values.clear({
      spreadsheetId: this.config.spreadsheetId,
      range: `'พร้อมยืม'!${row}:${row}`,
    });
  }
  async readPhotoReferences() {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const ranges = data.sheets.map((sheet) => quote(sheet.properties.title));
    if (!ranges.length) throw new Error('ไม่พบชีตสำหรับตรวจการใช้รูป');
    const response = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.config.spreadsheetId,
      ranges,
      valueRenderOption: 'FORMULA',
    });
    if (response.data.valueRanges?.length !== ranges.length)
      throw new Error('ตรวจการใช้รูปในชีตไม่ครบ');
    return response.data.valueRanges.flatMap((range) => (range.values || []).flat());
  }
  async addReadyToBorrowCategory(index) {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties',
    });
    const sheet = data.sheets.find((entry) => entry.properties.title === 'พร้อมยืม')?.properties;
    if (!sheet) throw Object.assign(new Error('ไม่พบชีตพร้อมยืม'), { status: 404 });
    const requests = [];
    if (sheet.gridProperties.columnCount <= index)
      requests.push({
        appendDimension: {
          sheetId: sheet.sheetId,
          dimension: 'COLUMNS',
          length: index + 1 - sheet.gridProperties.columnCount,
        },
      });
    requests.push({
      updateCells: {
        range: {
          sheetId: sheet.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: index,
          endColumnIndex: index + 1,
        },
        rows: [{ values: [{ userEnteredValue: { stringValue: 'หมวดหมู่' } }] }],
        fields: 'userEnteredValue',
      },
    });
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
  }
  async writeReadyToBorrowPhoto(row, headers, url, at) {
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `'พร้อมยืม'!${columnName(headers.indexOf('รูป (ลิงก์)'))}${row}`,
            values: [[url]],
          },
          {
            range: `'พร้อมยืม'!${columnName(headers.indexOf('วันที่อัปเดตล่าสุด'))}${row}`,
            values: [[at]],
          },
        ],
      },
    });
  }
  async readLoanSheets() {
    const { data } = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.config.spreadsheetId,
      ranges: ["'รายการยืมครุภัณฑ์'!A:AZ", "'รายการคืนครุภัณฑ์'!A:T"],
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return { loans: data.valueRanges[0].values || [], returns: data.valueRanges[1].values || [] };
  }
  async updateReturnStatus(id, status, responsible, condition, comment) {
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
    if (comment !== undefined)
      updates.push(...this.commentUpdates('รายการคืนครุภัณฑ์', grid.returns, index + 1, comment));
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
  async updateLoanStatus(id, status, responsible, comment, pickup) {
    const data = await this.readLoanSheets();
    const { indices } = loanColumnMapping(data.loans[0]);
    const indexes = data.loans.flatMap((row, index) =>
      index > 0 && row[indices[0]] === id ? [index + 1] : [],
    );
    if (indexes.length !== 1)
      throw Object.assign(new Error('รายการยืมเปลี่ยนไป กรุณาโหลดใหม่'), { status: 409 });
    const headers = [...data.loans[0]];
    const extraUpdates = [];
    const addField = (name, value) => {
      let index = headers.indexOf(name);
      if (index < 0) {
        index = headers.length;
        headers.push(name);
        extraUpdates.push({ range: `'รายการยืมครุภัณฑ์'!${columnName(index)}1`, values: [[name]] });
      }
      extraUpdates.push({
        range: `'รายการยืมครุภัณฑ์'!${columnName(index)}${indexes[0]}`,
        values: [[value]],
      });
    };
    if (comment !== undefined) addField('comment', comment);
    if (pickup !== undefined) {
      addField('วันที่นัดรับ', pickup.date);
      addField('เวลานัดรับ', pickup.time);
    }
    if (headers.length > data.loans[0].length) {
      const metadata = await this.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'sheets.properties',
      });
      const sheet = metadata.data.sheets.find(
        (entry) => entry.properties.title === 'รายการยืมครุภัณฑ์',
      )?.properties;
      if (!sheet) throw Object.assign(new Error('ไม่พบชีตรายการยืมครุภัณฑ์'), { status: 404 });
      if (headers.length > sheet.gridProperties.columnCount)
        await this.api.spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            requests: [
              {
                appendDimension: {
                  sheetId: sheet.sheetId,
                  dimension: 'COLUMNS',
                  length: headers.length - sheet.gridProperties.columnCount,
                },
              },
            ],
          },
        });
    }
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          ...extraUpdates,
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
  commentUpdates(title, grid, row, comment) {
    const existing = grid[0].indexOf('comment');
    const column = columnName(existing < 0 ? grid[0].length : existing);
    return [
      ...(existing < 0 ? [{ range: `${quote(title)}!${column}1`, values: [['comment']] }] : []),
      { range: `${quote(title)}!${column}${row}`, values: [[comment]] },
    ];
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
}
