import { configurationError } from './credentials.js';
export function applicationOrigin(env = process.env, variable = 'APP_URL') {
  const baseUrl =
    env[variable] ||
    (env.VERCEL === '1' ? 'https://iqi-asset.vercel.app' : 'http://localhost:3000');
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
    throw configurationError(`${variable} ต้องเป็น HTTPS origin หรือ HTTP localhost สำหรับทดสอบ`);
  }
}
