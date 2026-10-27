import { google } from 'googleapis';
import { configurationError, parseCredentialJSON, readCredentialFile } from './credentials.js';

export function driveCredentials(source) {
  const raw =
    typeof source === 'object' && source !== null
      ? parseCredentialJSON(source, 'GOOGLE_DRIVE_OAUTH_JSON')
      : readCredentialFile(source, 'GOOGLE_DRIVE_OAUTH_FILE');
  const client = raw.installed || raw.web || raw;
  if (
    typeof client.client_id !== 'string' ||
    !client.client_id ||
    typeof client.client_secret !== 'string' ||
    !client.client_secret
  )
    throw configurationError('Google Drive OAuth ต้องมี client_id และ client_secret');
  const refreshToken = raw.refresh_token || client.refresh_token || raw.tokens?.refresh_token;
  if (refreshToken !== undefined && typeof refreshToken !== 'string')
    throw configurationError('Google Drive OAuth refresh_token ต้องเป็นข้อความ');
  return { ...client, refresh_token: refreshToken };
}
export function driveOAuth(source) {
  const c = driveCredentials(source);
  const auth = new google.auth.OAuth2(c.client_id, c.client_secret);
  if (c.refresh_token) auth.setCredentials({ refresh_token: c.refresh_token });
  return { auth, connected: !!c.refresh_token };
}
