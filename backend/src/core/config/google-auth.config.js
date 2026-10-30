import { applicationOrigin } from './app-url.js';
import { configurationError } from './credentials.js';

export function loadGoogleAuthConfig(env = process.env) {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ALLOWED_DOMAIN'];
  for (const key of required) {
    if (typeof env[key] !== 'string' || !env[key].trim())
      throw configurationError(`กรุณาตั้งค่า ${key} สำหรับ Google Login`);
  }
  const allowedDomain = env.GOOGLE_ALLOWED_DOMAIN.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(allowedDomain))
    throw configurationError('GOOGLE_ALLOWED_DOMAIN ต้องเป็นชื่อโดเมนที่ถูกต้อง');
  return {
    clientId: env.GOOGLE_CLIENT_ID.trim(),
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    allowedDomain,
    redirectUri: `${applicationOrigin(env)}/api/auth/google/callback`,
  };
}
