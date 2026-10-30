import path from 'node:path';
import {
  configurationError,
  parseCredentialJSON,
  serviceAccountCredentials,
} from './credentials.js';

export function loadConfig(env = process.env) {
  const hosted = env.VERCEL === '1';
  if (hosted && (!env.APP_PASSWORD || !env.APP_SECRET))
    throw configurationError('Vercel ต้องตั้ง APP_PASSWORD และ APP_SECRET');
  if (hosted && !env.GOOGLE_SERVICE_ACCOUNT_JSON)
    throw configurationError('Vercel ต้องตั้ง GOOGLE_SERVICE_ACCOUNT_JSON');
  if (env.APP_SECRET && env.APP_SECRET.length < 32)
    throw configurationError('APP_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
  const config = {
    hosted,
    appSecret: env.APP_SECRET,
    allowedHosts: [
      env.VERCEL_URL,
      env.VERCEL_PROJECT_PRODUCTION_URL,
      'iqi-asset-dev.vercel.app',
      ...(env.ALLOWED_HOSTS || '').split(','),
    ]
      .filter(Boolean)
      .map((host) => host.trim().toLowerCase()),
    serviceAccount: serviceAccountCredentials(env.GOOGLE_SERVICE_ACCOUNT_JSON),
    driveOAuthCredentials: parseCredentialJSON(
      env.GOOGLE_DRIVE_OAUTH_JSON,
      'GOOGLE_DRIVE_OAUTH_JSON',
    ),
    photoFolderId: env.GOOGLE_PHOTO_FOLDER_ID || '1C42KW3QDHJ2X4scDba0p11TV1xM4L8-z',
    driveOAuthFile: env.GOOGLE_DRIVE_OAUTH_FILE || '',
    maxUploadBytes: hosted ? 4 * 1024 * 1024 : 25 * 1024 * 1024,
    publicPhotoPreview: env.PUBLIC_PHOTO_PREVIEW === 'true',
    port: Number(env.PORT || 3000),
    host: env.HOST || '0.0.0.0',
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID || '1IvDnE8yCqN232ZuaXgNSj-42Zm4k1IjDYFNgsXXWdHo',
    keyFile: path.resolve(env.GOOGLE_SERVICE_ACCOUNT_FILE || 'credentials/service-account.json'),
    sheets: [
      env.SHEET_IQI || 'IQI',
      env.SHEET_ALL_ITEMS || 'รายการทั้งหมด',
      env.SHEET_ALL || 'all',
    ],
    dateHeader: env.IQI_DATE_HEADER || '',
    dateMode: env.IQI_DATE_MODE || 'date',
    password: env.APP_PASSWORD || '1234',
  };
  if (new Set(config.sheets).size !== 3)
    throw configurationError('ชื่อ Sheet ทั้งสามต้องไม่ซ้ำกัน');

  return config;
}
