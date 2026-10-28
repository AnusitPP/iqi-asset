import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from '../src/config/config.js';
import { driveCredentials } from '../src/integrations/google/driveAuth.js';

async function connect() {
  if (!config.driveOAuthFile)
    throw new Error('ตั้ง GOOGLE_DRIVE_OAUTH_FILE=./credentials/drive-oauth.json ใน .env ก่อน');
  const file = path.resolve(config.driveOAuthFile);
  const c = driveCredentials(file);
  const state = randomBytes(32).toString('hex');
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const redirect = `http://127.0.0.1:${server.address().port}/oauth/callback`;
    const auth = new google.auth.OAuth2(c.client_id, c.client_secret, redirect);
    const { codeVerifier, codeChallenge } = await auth.generateCodeVerifierAsync();
    const callback = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('หมดเวลารอ กรุณารัน npm run drive:connect ใหม่')),
        300000,
      );
      server.on('request', (req, res) => {
        const url = new URL(req.url, redirect);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (url.pathname !== '/oauth/callback' || url.searchParams.get('state') !== state) {
          res.writeHead(400).end('คำขอไม่ถูกต้อง');
          return;
        }
        if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
          res.writeHead(400).end('ไม่พบรหัสอนุญาต');
          return;
        }
        clearTimeout(timer);
        res.end('ได้รับคำตอบจาก Google แล้ว กลับไปดูผลตรวจสิทธิ์ใน Terminal ได้เลย');
        if (url.searchParams.has('error'))
          reject(new Error('ไม่ได้รับอนุญาตจาก Google กรุณาลองใหม่'));
        else resolve(url.searchParams.get('code'));
      });
    });
    console.log('เปิดลิงก์นี้ในเบราว์เซอร์ แล้วเลือกบัญชีที่มีสิทธิ์เพิ่มไฟล์ในโฟลเดอร์รูป:');
    console.log(
      auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        state,
        // The configured folder already exists and was not created/selected via this app.
        scope: ['https://www.googleapis.com/auth/drive'],
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
      }),
    );
    const code = await callback;
    const { tokens } = await auth.getToken({ code, codeVerifier });
    if (!tokens.refresh_token) throw new Error('Google ไม่ส่ง refresh token กรุณาเชื่อมบัญชีใหม่');
    auth.setCredentials(tokens);
    await fs.writeFile(
      file,
      JSON.stringify(
        {
          client_id: c.client_id,
          client_secret: c.client_secret,
          refresh_token: tokens.refresh_token,
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    await fs.chmod(file, 0o600);
    const drive = google.drive({ version: 'v3', auth, timeout: 20000 });
    const { data: folder } = await drive.files.get({
      fileId: config.photoFolderId,
      supportsAllDrives: true,
      fields: 'mimeType,capabilities(canAddChildren)',
    });
    if (
      folder.mimeType !== 'application/vnd.google-apps.folder' ||
      !folder.capabilities?.canAddChildren
    )
      throw new Error(
        'บันทึกการเชื่อมบัญชีแล้ว แต่บัญชีนี้ยังเพิ่มรูปในโฟลเดอร์ไม่ได้ กรุณาให้เจ้าของแชร์เป็น Editor แล้วลองใหม่',
      );
    console.log(
      'เชื่อม Google Drive แล้ว และมีสิทธิ์เพิ่มรูปในโฟลเดอร์ กรุณารีสตาร์ตแอปแล้วลองอัปโหลด',
    );
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

connect().catch((error) => {
  // Do not print Google HTTP errors: they may contain tokens or client secrets.
  console.error(
    error.response
      ? 'เชื่อม Drive ไม่สำเร็จ ตรวจว่าเปิด Drive API และบัญชีมีสิทธิ์ในโฟลเดอร์ แล้วลองใหม่'
      : error.message,
  );
  process.exitCode = 1;
});
