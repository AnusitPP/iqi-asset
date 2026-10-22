import 'dotenv/config';
import path from 'node:path';
export const config = {
  photoFolderId: process.env.GOOGLE_PHOTO_FOLDER_ID || '1C42KW3QDHJ2X4scDba0p11TV1xM4L8-z',
  driveOAuthFile: process.env.GOOGLE_DRIVE_OAUTH_FILE || '',
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  spreadsheetId:
    process.env.GOOGLE_SPREADSHEET_ID || '1IvDnE8yCqN232ZuaXgNSj-42Zm4k1IjDYFNgsXXWdHo',
  keyFile: path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'credentials/service-account.json',
  ),
  sheets: [
    process.env.SHEET_IQI || 'IQI',
    process.env.SHEET_ALL_ITEMS || 'รายการทั้งหมด',
    process.env.SHEET_ALL || 'all',
  ],
  dateHeader: process.env.IQI_DATE_HEADER || '',
  dateMode: process.env.IQI_DATE_MODE || 'date',
  password: process.env.APP_PASSWORD || '1234',
};
if (new Set(config.sheets).size !== 3) throw new Error('ชื่อ Sheet ทั้งสามต้องไม่ซ้ำกัน');
