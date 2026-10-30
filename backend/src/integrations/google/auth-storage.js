import { google } from 'googleapis';
import { configurationError } from '../../core/config/credentials.js';
const SCHEMA = {
  Users: [
    'id',
    'google_sub',
    'email',
    'name',
    'avatar_url',
    'status',
    'last_login_at',
    'created_at',
    'updated_at',
  ],
  Admins: ['id', 'user_id', 'email', 'role', 'status', 'assigned_by', 'created_at', 'updated_at'],
  Sessions: [
    'id',
    'user_id',
    'session_token_hash',
    'created_at',
    'expires_at',
    'revoked_at',
    'last_seen_at',
  ],
  AuditLogs: [
    'id',
    'actor_user_id',
    'actor_google_sub',
    'actor_name_snapshot',
    'actor_email_snapshot',
    'action',
    'entity_type',
    'entity_id',
    'before_data',
    'after_data',
    'created_at',
  ],
};
export class AuthSheetStorage {
  constructor(config, api) {
    this.spreadsheetId = config.authSpreadsheetId;
    const auth = new google.auth.GoogleAuth({
      ...(config.serviceAccount
        ? { credentials: config.serviceAccount }
        : { keyFile: config.keyFile }),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.api = api || google.sheets({ version: 'v4', auth });
  }
  async read() {
    const { data } = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: Object.keys(SCHEMA).map((name) => `'${name}'`),
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const tables = {};
    for (const [index, name] of Object.keys(SCHEMA).entries()) {
      const rows = data.valueRanges[index]?.values || [];
      if (JSON.stringify(rows[0]) !== JSON.stringify(SCHEMA[name]))
        throw configurationError(`หัวคอลัมน์ ${name} ในชีต Authentication ไม่ถูกต้อง`);
      tables[name] = rows
        .slice(1)
        .map((values, offset) => ({
          row: offset + 1,
          ...Object.fromEntries(
            SCHEMA[name].map((key, column) => [key, String(values[column] ?? '')]),
          ),
        }))
        .filter((record) => record.id);
    }
    return tables;
  }
  async write(operations) {
    const { data } = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties',
    });
    const requests = operations
      .map(({ table, row, values }) => {
        const sheetId = data.sheets.find((sheet) => sheet.properties.title === table)?.properties
          .sheetId;
        if (sheetId === undefined || !SCHEMA[table])
          throw configurationError('ไม่พบตาราง Authentication');
        if (row === undefined)
          return {
            appendCells: {
              sheetId,
              rows: [
                {
                  values: SCHEMA[table].map((key) => ({
                    userEnteredValue: { stringValue: String(values[key] ?? '') },
                  })),
                },
              ],
              fields: 'userEnteredValue',
            },
          };
        // Patch only supplied columns: profile refresh must never overwrite a concurrent disable.
        return Object.entries(values).map(([key, value]) => {
          const columnIndex = SCHEMA[table].indexOf(key);
          if (columnIndex < 0 || !Number.isInteger(row) || row < 1)
            throw configurationError('ข้อมูล Authentication ไม่ถูกต้อง');
          return {
            updateCells: {
              start: { sheetId, rowIndex: row, columnIndex },
              rows: [{ values: [{ userEnteredValue: { stringValue: String(value ?? '') } }] }],
              fields: 'userEnteredValue',
            },
          };
        });
      })
      .flat();
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests },
    });
  }
}
