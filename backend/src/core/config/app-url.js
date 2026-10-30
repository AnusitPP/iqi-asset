import { configurationError } from './credentials.js';
export function applicationOrigin(env = process.env) {
  const baseUrl =
    env.APP_URL || (env.VERCEL === '1' ? 'https://iqi-asset.vercel.app' : 'http://localhost:3000');
  try {
    const parsed = new URL(baseUrl);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
    )
      throw new Error();
    return parsed.origin;
  } catch {
    throw configurationError('APP_URL ต้องเป็น HTTPS origin หรือ HTTP localhost สำหรับทดสอบ');
  }
}
