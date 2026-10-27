import fs from 'node:fs';

export function configurationError(message) {
  return Object.assign(new Error(message), {
    status: 503,
    publicMessage: message,
    code: 'APP_CONFIGURATION',
  });
}
export function parseCredentialJSON(value, name) {
  if (value === undefined || value === '') return undefined;
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw configurationError(`${name} ต้องเป็น JSON ที่ถูกต้อง`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw configurationError(`${name} ต้องเป็น JSON object`);
  return parsed;
}
export function serviceAccountCredentials(value) {
  const parsed = parseCredentialJSON(value, 'GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!parsed) return undefined;
  if (
    typeof parsed.client_email !== 'string' ||
    !parsed.client_email ||
    typeof parsed.private_key !== 'string' ||
    !parsed.private_key
  )
    throw configurationError('GOOGLE_SERVICE_ACCOUNT_JSON ต้องมี client_email และ private_key');
  return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, '\n') };
}
export function readCredentialFile(file, name) {
  if (!file) throw configurationError(`กรุณาตั้งค่า ${name} หรือ JSON credentials`);
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    throw configurationError(`อ่านไฟล์ ${name} ไม่สำเร็จ กรุณาตรวจ path และสิทธิ์ไฟล์`);
  }
  const parsed = parseCredentialJSON(contents, name);
  if (!parsed) throw configurationError(`${name} ต้องเป็น JSON object ที่ไม่ว่าง`);
  return parsed;
}
