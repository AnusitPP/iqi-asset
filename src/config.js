import 'dotenv/config';
import path from 'node:path';
const hosted = process.env.VERCEL === '1';
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
if (!!redisUrl !== !!redisToken) throw new Error('ต้องตั้งค่า Redis URL และ token ให้ครบ');
if (hosted && (!process.env.APP_PASSWORD || !process.env.APP_SECRET || !redisUrl))
  throw new Error('Vercel ต้องตั้ง APP_PASSWORD, APP_SECRET และ Upstash Redis');
if (process.env.APP_SECRET && process.env.APP_SECRET.length < 32)
  throw new Error('APP_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
export const config = {
  hosted,
  appSecret: process.env.APP_SECRET,
  redisUrl,
  redisToken,
  statePrefix: process.env.STATE_PREFIX || `iqi:${process.env.VERCEL_ENV || 'local'}`,
  allowedHosts: [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.ALLOWED_HOSTS || '').split(',')].filter(Boolean).map((host) => host.trim().toLowerCase()),
  serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : undefined,
  driveOAuthCredentials: process.env.GOOGLE_DRIVE_OAUTH_JSON
    ? JSON.parse(process.env.GOOGLE_DRIVE_OAUTH_JSON) : undefined,
  photoFolderId: process.env.GOOGLE_PHOTO_FOLDER_ID || '1C42KW3QDHJ2X4scDba0p11TV1xM4L8-z',
  driveOAuthFile: process.env.GOOGLE_DRIVE_OAUTH_FILE || '',
  maxUploadBytes: hosted ? 4 * 1024 * 1024 : 25 * 1024 * 1024,
  publicPhotoPreview: process.env.PUBLIC_PHOTO_PREVIEW === 'true',
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
