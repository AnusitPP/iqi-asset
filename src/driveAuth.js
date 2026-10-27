import fs from 'node:fs';
import { google } from 'googleapis';

export function driveCredentials(file) {
  const raw = typeof file === 'object' && file !== null
    ? file : JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = raw.installed || raw.web || raw;
  if (!client.client_id || !client.client_secret)
    throw new Error('ไฟล์ OAuth ต้องมี client_id และ client_secret จาก Google Cloud');
  return { ...client, refresh_token: raw.refresh_token || client.refresh_token };
}

export function driveOAuth(file) {
  const c = driveCredentials(file);
  const auth = new google.auth.OAuth2(c.client_id, c.client_secret);
  if (c.refresh_token) auth.setCredentials({ refresh_token: c.refresh_token });
  return { auth, connected: !!c.refresh_token };
}
