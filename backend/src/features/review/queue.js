import { toBangkokSheetSerial as reviewTimestamp } from '../../../../shared/core/extensions/dates.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { createHash, randomInt } from 'node:crypto';
import {
  SEARCH_STATUS_HEADER,
  PENDING_STATUS,
} from '../../../../shared/features/records/searchStatus.js';
import { displayFieldValue } from '../../../../shared/core/formatters/labels.js';
export const REVIEW_SHEET = 'รอตรวจสอบ';
export const REVIEW_DATE_HEADER = 'วันที่แก้ไข';
export const INSPECTION_HEADER = 'สถานะการตรวจสอบ';
export const INSPECTION_STATUSES = ['ดี', 'ชำรุด', 'หาไม่เจอ'];
export { toBangkokSheetSerial as reviewTimestamp } from '../../../../shared/core/extensions/dates.js';
export const REVIEW_HEADERS = [
  'รายการ / อุปกรณ์',
  'ชื่อ - นามสกุล',
  'ชื่อเล่น',
  'ชื่อย่อ',
  'ทีม',
  'ยี่ห้อ / Brand',
  'Serial Number (S/N)',
  'เลขครุภัณฑ์',
  'รายละเอียด',
  '_source_key',
  '_source_sheet',
  '_source_row',
];
const key = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s._()/\-–—]/g, '');
export function reviewValues(table, record) {
  const get = (names) => {
    const indices = table.headers.flatMap((header, i) =>
      names.some((name) => key(name) === key(header)) ? [i] : [],
    );
    return indices.map((i) => record.values[i] || '').find(Boolean) || '';
  };
  return [
    get(['รายการ', 'อุปกรณ์', 'รายการ / อุปกรณ์']),
    get(['ชื่อ - นามสกุล', 'ชื่อ - สกุล', 'ชื่อผู้ถือครอง', 'ชื่อ']),
    get(['ชื่อเล่น']),
    get(['ชื่อย่อ']),
    displayFieldValue('ทีม', get(['ทีม'])),
    get(['ยี่ห้อ', 'Brand', 'ยี่ห้อ / Brand']),
    get(['Serial Number (S/N)', 'Serial Number', 'S/N', 'SN', 'Serial No.']),
    record.values[table.assetIndex] || '',
    get(['รายละเอียด']),
  ];
}
export function reviewKey(table, record) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        table.sheet,
        table.headers.flatMap((header, i) =>
          header.trim() === SEARCH_STATUS_HEADER ? [] : [[header, record.values[i] || '']],
        ),
      ]),
    )
    .digest('hex');
}
const quote = (name) => `'${name.replaceAll("'", "''")}'`;
export class ReviewQueue {
  constructor(adapter, sheet = REVIEW_SHEET) {
    this.adapter = adapter;
    this.config = adapter.config;
    this.sheet = sheet;
  }
  async metadata() {
    return (
      await this.adapter.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'spreadsheetUrl,sheets.properties',
      })
    ).data;
  }
  async values(valueRenderOption = 'FORMATTED_VALUE') {
    return (
      (
        await this.adapter.api.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: quote(this.sheet),
          valueRenderOption,
        })
      ).data.values || []
    );
  }
  validate(rows) {
    if (JSON.stringify((rows[0] || []).slice(0, 12)) !== JSON.stringify(REVIEW_HEADERS))
      fail(422, 'หัวคอลัมน์ชีตรอตรวจสอบไม่ตรงกับโครงสร้างของแอป กรุณาตรวจสอบก่อนบันทึก');
  }
  async ensure() {
    const metadata = await this.metadata();
    let properties = metadata.sheets.find(
      (ledgerState) => ledgerState.properties.title === this.sheet,
    )?.properties;
    const rows = properties ? await this.values() : [];
    const rawRows = properties ? await this.values('FORMULA') : [];
    const populated = rawRows.some((row) => row.some((fieldValue) => String(fieldValue).trim()));
    if (populated) {
      this.validate(rows);
      this.properties = properties;
      const dateAdded = await this.ensureDateColumn(properties, rows, rawRows);
      const statusAdded = await this.ensureInspectionColumn(properties);
      await this.ensureStatusColors();
      return dateAdded || statusAdded;
    }
    const requests = [];
    if (!properties) {
      let sheetId;
      do {
        sheetId = randomInt(1, 1000000000);
      } while (metadata.sheets.some((ledgerState) => ledgerState.properties.sheetId === sheetId));
      properties = {
        sheetId,
        title: this.sheet,
        gridProperties: { rowCount: 1000, columnCount: 12, frozenRowCount: 1 },
      };
      requests.push({ addSheet: { properties } });
    } else {
      if (properties.gridProperties.columnCount < 12)
        requests.push({
          appendDimension: {
            sheetId: properties.sheetId,
            dimension: 'COLUMNS',
            length: 12 - properties.gridProperties.columnCount,
          },
        });
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }
    const sheetId = properties.sheetId;
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 12,
        },
        rows: [
          { values: REVIEW_HEADERS.map((stringValue) => ({ userEnteredValue: { stringValue } })) },
        ],
        fields: 'userEnteredValue',
      },
    });
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 12,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.91, green: 0.96, blue: 0.93 },
            textFormat: { bold: true },
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 },
        properties: { pixelSize: 170 },
        fields: 'pixelSize',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
        properties: { pixelSize: 320 },
        fields: 'pixelSize',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 9, endIndex: 12 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
    await this.adapter.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
    this.properties = properties;
    const fresh = await this.values();
    this.validate(fresh);
    await this.ensureDateColumn(properties, fresh, fresh);
    await this.ensureInspectionColumn(properties);
    await this.ensureStatusColors();
    return true;
  }
  async ensureDateColumn(properties, rows, rawRows) {
    if (rows[0]?.[12] === REVIEW_DATE_HEADER) return false;
    const sheetId = properties.sheetId,
      requests = [];
    if (rawRows.some((row) => row.slice(12).some((fieldValue) => String(fieldValue).trim())))
      requests.push({
        insertDimension: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 },
          inheritFromBefore: true,
        },
      });
    else if (properties.gridProperties.columnCount < 13)
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: 13 - properties.gridProperties.columnCount,
        },
      });
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 12,
          endColumnIndex: 13,
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: { stringValue: REVIEW_DATE_HEADER },
                userEnteredFormat: {
                  backgroundColor: { red: 0.91, green: 0.96, blue: 0.93 },
                  textFormat: { bold: true },
                  wrapStrategy: 'WRAP',
                },
              },
            ],
          },
        ],
        fields: 'userEnteredValue,userEnteredFormat',
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm:ss' },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 },
        properties: { hiddenByUser: false, pixelSize: 180 },
        fields: 'hiddenByUser,pixelSize',
      },
    });
    await this.adapter.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
    if ((await this.values())[0]?.[12] !== REVIEW_DATE_HEADER)
      fail(409, 'ยืนยันคอลัมน์วันที่แก้ไขไม่ได้');
    return true;
  }
  get url() {
    return this.properties
      ? `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/edit#gid=${this.properties.sheetId}`
      : null;
  }
  async ensureStatusColors() {
    const marker = 'IQI_INSPECTION_STATUS_V1';
    const data = (
      await this.adapter.api.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'sheets(properties(sheetId,title,gridProperties),conditionalFormats)',
      })
    ).data;
    const sheet = data.sheets.find((ledgerState) => ledgerState.properties.title === this.sheet);
    if (!sheet) fail(404, 'ไม่พบชีตรอตรวจสอบ');
    const existing = sheet.conditionalFormats || [],
      owned = existing.flatMap((rule, i) =>
        rule.booleanRule?.condition?.values?.some((fieldValue) =>
          String(fieldValue.userEnteredValue).includes(marker),
        )
          ? [i]
          : [],
      );
    const colors = [
      { red: 0.91, green: 0.96, blue: 0.92 },
      { red: 1, green: 0.97, blue: 0.82 },
      { red: 1, green: 0.9, blue: 0.9 },
    ];
    const rules = INSPECTION_STATUSES.map((status, i) => ({
      ranges: [{ sheetId: sheet.properties.sheetId, startRowIndex: 1 }],
      booleanRule: {
        condition: {
          type: 'CUSTOM_FORMULA',
          values: [{ userEnteredValue: `=AND($N2="${status}",N("${marker}")=0)` }],
        },
        format: { backgroundColor: colors[i] },
      },
    }));
    const same =
      owned.length === 3 &&
      owned.every((index, i) => {
        const rule = existing[index],
          range = rule.ranges?.[0],
          color = rule.booleanRule?.format?.backgroundColor || {};
        return (
          rule.ranges?.length === 1 &&
          range.sheetId === sheet.properties.sheetId &&
          range.startRowIndex === 1 &&
          (!range.endRowIndex || range.endRowIndex === sheet.properties.gridProperties.rowCount) &&
          (!range.endColumnIndex ||
            range.endColumnIndex === sheet.properties.gridProperties.columnCount) &&
          !range.startColumnIndex &&
          rule.booleanRule?.condition?.values?.[0]?.userEnteredValue ===
            rules[i].booleanRule.condition.values[0].userEnteredValue &&
          ['red', 'green', 'blue'].every((c) => Math.abs((color[c] || 0) - colors[i][c]) < 1 / 255)
        );
      });
    if (same) return false;
    const requests = [
      ...owned.reverse().map((index) => ({
        deleteConditionalFormatRule: { sheetId: sheet.properties.sheetId, index },
      })),
      ...rules.map((rule, index) => ({ addConditionalFormatRule: { rule, index } })),
    ];
    await this.adapter.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
    return true;
  }
  async ensureInspectionColumn(properties) {
    const rows = await this.values('FORMULA');
    if (rows[0]?.[13] === INSPECTION_HEADER) return false;
    const sheetId = properties.sheetId,
      requests = [];
    // Append safely even when the preceding migration expanded the grid.
    const fresh = (await this.metadata()).sheets.find(
      (ledgerState) => ledgerState.properties.sheetId === sheetId,
    ).properties;
    if (rows.some((row) => row.slice(13).some((fieldValue) => String(fieldValue).trim())))
      requests.push({
        insertDimension: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 },
          inheritFromBefore: true,
        },
      });
    else if (fresh.gridProperties.columnCount < 14)
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: 14 - fresh.gridProperties.columnCount,
        },
      });
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 13,
          endColumnIndex: 14,
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: { stringValue: INSPECTION_HEADER },
                userEnteredFormat: {
                  backgroundColor: { red: 0.91, green: 0.96, blue: 0.93 },
                  textFormat: { bold: true },
                },
              },
            ],
          },
        ],
        fields: 'userEnteredValue,userEnteredFormat',
      },
    });
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 13, endColumnIndex: 14 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: INSPECTION_STATUSES.map((userEnteredValue) => ({ userEnteredValue })),
          },
          strict: true,
          showCustomUi: true,
        },
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 },
        properties: { hiddenByUser: false, pixelSize: 170 },
        fields: 'hiddenByUser,pixelSize',
      },
    });
    await this.adapter.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: { requests },
    });
    return true;
  }
  async inspection(table, record, update) {
    const queue = await this.read(),
      key = reviewKey(table, record),
      entries = queue.entries.filter((e) => e.key === key);
    if (entries.length !== 1)
      fail(409, 'กรุณากดหัวใจเพิ่มรายการเข้ารอตรวจสอบก่อน หรือค้นหาใหม่หากรายการเปลี่ยนไป');
    const entry = entries[0],
      raw = queue.rawRows[entry.row - 1];
    const revision = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
    const present = () => ({
      inspectionRevision: revision,
      status: String(raw[13] || ''),
      date: String(queue.rows[entry.row - 1]?.[12] || ''),
    });
    if (!update) return present();
    if (!INSPECTION_STATUSES.includes(update.status))
      fail(400, 'กรุณาเลือกสถานะ ดี ชำรุด หรือ หาไม่เจอ');
    if (update.inspectionRevision !== revision)
      fail(409, 'ผลตรวจถูกแก้ไขแล้ว กรุณาปิดแล้วเปิดบันทึกผลตรวจใหม่');
    if (raw[13] === update.status) return { ...present(), unchanged: true };
    const metadata = await this.metadata();
    const properties = metadata.sheets.find(
      (ledgerState) => ledgerState.properties.title === this.sheet,
    )?.properties;
    if (
      properties?.sheetId !== this.properties?.sheetId ||
      queue.rows[0]?.[13] !== INSPECTION_HEADER
    )
      fail(409, 'โครงสร้างชีตเปลี่ยนไป กรุณาเริ่มเซิร์ฟเวอร์ใหม่');
    const stamp = reviewTimestamp();
    await this.adapter.api.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: properties.sheetId,
                startRowIndex: entry.row - 1,
                endRowIndex: entry.row,
                startColumnIndex: 12,
                endColumnIndex: 14,
              },
              rows: [
                {
                  values: [
                    { userEnteredValue: { numberValue: stamp } },
                    { userEnteredValue: { stringValue: update.status } },
                  ],
                },
              ],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });
    const fresh = await this.read();
    const saved = fresh.entries.filter((e) => e.key === key);
    if (
      saved.length !== 1 ||
      fresh.rawRows[saved[0].row - 1]?.[13] !== update.status ||
      Number(fresh.rawRows[saved[0].row - 1]?.[12]) !== stamp
    )
      fail(409, 'บันทึกแล้วแต่ยืนยันผลไม่ได้ กรุณาเปิดผลตรวจใหม่ก่อนบันทึกซ้ำ');
    return { status: update.status, date: String(fresh.rows[saved[0].row - 1][12]) };
  }
  async read() {
    const [rows, rawRows] = await Promise.all([this.values(), this.values('FORMULA')]);
    return this.parse(rows, rawRows);
  }
  parse(rows, rawRows) {
    this.validate(rows);
    const entries = rows.slice(1).flatMap((values, i) =>
      values[9]
        ? [
            {
              row: i + 2,
              key: String(values[9]),
              queueSheet: this.sheet,
              inspectionStatus: String(values[13] || ''),
              inspectionDate: String(values[12] || ''),
              sourceSheet: String(values[10] || ''),
              sourceRow: Number(values[11]),
              values: Array.from({ length: 9 }, (_, c) => String(values[c] ?? '')),
            },
          ]
        : [],
    );
    return { rows, rawRows, entries };
  }
  async setSelection(table, record, pending) {
    const index = table.headers.findIndex((header) => header.trim() === SEARCH_STATUS_HEADER);
    const changes =
      table.sheet === this.config.sheets[0] &&
      index >= 0 &&
      record.values[index] !== (pending ? PENDING_STATUS : '')
        ? [{ index, value: pending ? PENDING_STATUS : '' }]
        : [];
    return this.apply(table, record, record, pending, changes);
  }
  async applyChanges(table, record, changes) {
    const next = { ...record, values: [...record.values] };
    for (const change of changes) next.values[change.index] = change.value;
    const index = table.headers.findIndex((header) => header.trim() === SEARCH_STATUS_HEADER);
    return this.apply(
      table,
      record,
      next,
      index >= 0 && next.values[index] === PENDING_STATUS,
      changes,
    );
  }
  async apply(table, original, next, pending, changes) {
    const [queue, metadata] = await Promise.all([this.read(), this.metadata()]);
    const properties = metadata.sheets.find(
      (ledgerState) => ledgerState.properties.title === this.sheet,
    )?.properties;
    if (!properties || properties.sheetId !== this.properties?.sheetId)
      fail(409, 'ชีตรอตรวจสอบเปลี่ยนไป กรุณาเริ่มเซิร์ฟเวอร์ใหม่');
    const oldKey = reviewKey(table, original),
      newKey = reviewKey(table, next);
    const matches = queue.entries.filter((entry) => entry.key === oldKey || entry.key === newKey);
    if (matches.length > 1) fail(409, 'พบรายการซ้ำในชีตรอตรวจสอบ กรุณาตรวจสอบก่อนทำต่อ');
    const existing = matches[0];
    const requests = [];
    let expected = null;
    if (changes.length) {
      if (table.sheet !== this.config.sheets[0]) fail(403, 'ไม่อนุญาตให้แก้ไขต้นฉบับ Sheet นี้');
      const sourceId = metadata.sheets.find(
        (ledgerState) => ledgerState.properties.title === table.sheet,
      )?.properties.sheetId;
      if (sourceId === undefined) fail(404, 'ไม่พบ Sheet ต้นฉบับ');
      for (const change of changes)
        requests.push({
          updateCells: {
            range: {
              sheetId: sourceId,
              startRowIndex: original.row - 1,
              endRowIndex: original.row,
              startColumnIndex: change.index,
              endColumnIndex: change.index + 1,
            },
            rows: [{ values: [{ userEnteredValue: { stringValue: change.value } }] }],
            fields: 'userEnteredValue',
          },
        });
    }
    if (pending && (!existing || existing.key !== newKey)) {
      expected = reviewValues(table, next);
      const blank = queue.rawRows.findIndex(
        (row, i) => i > 0 && !row.some((fieldValue) => String(fieldValue).trim()),
      );
      const row = existing?.row || (blank > 0 ? blank + 1 : queue.rawRows.length + 1);
      if (row > properties.gridProperties.rowCount)
        requests.push({
          appendDimension: {
            sheetId: properties.sheetId,
            dimension: 'ROWS',
            length: row - properties.gridProperties.rowCount,
          },
        });
      const values = [...expected, newKey, table.sheet, String(original.row)];
      const cells = values.map((stringValue) => ({ userEnteredValue: { stringValue } }));
      // Heart selection only stages a copy. Inspection dates are recorded separately.
      requests.push({
        updateCells: {
          range: {
            sheetId: properties.sheetId,
            startRowIndex: row - 1,
            endRowIndex: row,
            startColumnIndex: 0,
            endColumnIndex: 12,
          },
          rows: [{ values: cells }],
          fields: 'userEnteredValue',
        },
      });
    } else if (!pending && existing) {
      requests.push({
        updateCells: {
          range: {
            sheetId: properties.sheetId,
            startRowIndex: existing.row - 1,
            endRowIndex: existing.row,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          rows: [{ values: Array.from({ length: 14 }, () => ({})) }],
          fields: 'userEnteredValue',
        },
      });
    }
    if (requests.length)
      await this.adapter.api.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: { requests },
      });
    const fresh = await this.read();
    const found = fresh.entries.filter((entry) => entry.key === newKey || entry.key === oldKey);
    if (
      pending
        ? found.length !== 1 ||
          found[0].key !== newKey ||
          (expected && JSON.stringify(found[0].values) !== JSON.stringify(expected))
        : found.length !== 0
    )
      fail(409, 'ส่งข้อมูลแล้วแต่ยืนยันชีตรอตรวจสอบไม่ได้ กรุณาค้นหาใหม่ก่อนกดซ้ำ');
    return { pending, reviewUrl: this.url };
  }
}
