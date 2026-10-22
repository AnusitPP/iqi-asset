import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { driveOAuth } from './driveAuth.js';
import { dashboardData } from './dashboard.js';
export const PHOTO_HEADER = 'ลิงก์รูปครุภัณฑ์';
export const PHOTO_DATE_HEADER = 'วันที่อัปโหลดรูป';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function photoIds(value = '') {
  return [
    ...new Set(
      String(value)
        .split('\n')
        .map((s) => s.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/)?.[1])
        .filter(Boolean),
    ),
  ];
}
export async function preparePhoto(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > 25 * 1024 * 1024)
    fail(400, 'รูปต้องมีขนาดไม่เกิน 25 MB');
  let buffer = input;
  const isHeic =
    input.length > 12 &&
    input.toString('ascii', 4, 8) === 'ftyp' &&
    /heic|heix|hevc|hevx|mif1|msf1/.test(input.toString('ascii', 8, 64));
  if (isHeic) {
    try {
      buffer = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 0.9 }));
    } catch {
      fail(400, 'แปลง HEIC ไม่สำเร็จ กรุณาเลือก JPEG หรือถ่ายรูปใหม่');
    }
  }
  try {
    return await sharp(buffer, { limitInputPixels: 80000000, animated: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#fff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    fail(400, 'อ่านรูปไม่ได้ รองรับ JPEG, PNG, WebP และ HEIC/HEIF');
  }
}
export class PhotoStore {
  constructor(config) {
    this.folder = config.photoFolderId || '1C42KW3QDHJ2X4scDba0p11TV1xM4L8-z';
    this.userAuth = !!config.driveOAuthFile;
    this.publicPhotoPreview = config.publicPhotoPreview === true;
    let auth;
    this.oauthConnected = true;
    if (this.userAuth) {
      const connection = driveOAuth(config.driveOAuthFile);
      auth = connection.auth;
      this.oauthConnected = connection.connected;
    } else
      auth = new google.auth.GoogleAuth({
        keyFile: config.keyFile,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    this.drive = google.drive({ version: 'v3', auth, timeout: 20000 });
  }
  async upload(buffer, name) {
    try {
      if (!this.oauthConnected)
        fail(
          422,
          'ยังไม่ได้อนุญาตบัญชี Google Drive กรุณารัน npm run drive:connect แล้วรีสตาร์ตแอป',
        );
      const folder = (
        await this.drive.files.get({
          fileId: this.folder,
          supportsAllDrives: true,
          fields: 'id,driveId,capabilities(canAddChildren)',
        })
      ).data;
      if (!folder.capabilities?.canAddChildren)
        fail(
          422,
          this.userAuth
            ? 'บัญชี Google ที่เชื่อมอยู่ยังเพิ่มรูปในโฟลเดอร์ FM ไม่ได้ กรุณาแชร์โฟลเดอร์ให้บัญชีนี้เป็น Editor หรือรัน npm run drive:connect เพื่อเปลี่ยนบัญชี'
            : 'แอปยังไม่มีสิทธิ์เพิ่มรูปในโฟลเดอร์ FM กรุณาแชร์โฟลเดอร์ให้บัญชี Service Account เป็น Editor',
        );
      if (!folder.driveId && !this.userAuth)
        fail(
          422,
          'โฟลเดอร์ FM อยู่ใน My Drive ซึ่ง Service Account อัปโหลดไม่ได้ ต้องเชื่อมบัญชี Google ของเจ้าของไดรฟ์ หรือใช้โฟลเดอร์ใน Shared Drive',
        );
      const file = (
        await this.drive.files.create({
          supportsAllDrives: true,
          requestBody: { name, mimeType: 'image/jpeg', parents: [this.folder] },
          media: { mimeType: 'image/jpeg', body: Readable.from(buffer) },
          fields: 'id,webViewLink',
        })
      ).data;
      if (this.publicPhotoPreview) {
        try {
          await this.drive.permissions.create({
            fileId: file.id,
            supportsAllDrives: true,
            requestBody: { type: 'anyone', role: 'reader' },
            fields: 'id',
          });
        } catch (error) {
          fail(
            422,
            `อัปโหลดรูปแล้ว แต่เปิดสิทธิ์ดูภาพสำหรับ Google Sheets ไม่สำเร็จ (อาจถูกนโยบายองค์กรจำกัด): ${file.id}`,
          );
        }
      }
      return { id: file.id, url: `https://drive.google.com/file/d/${file.id}/view` };
    } catch (e) {
      if (e.status === 422) throw e;
      if (/invalid_grant|invalid_client/i.test(e.message))
        fail(
          422,
          'การอนุญาต Google Drive หมดอายุหรือถูกยกเลิก กรุณารัน npm run drive:connect แล้วรีสตาร์ตแอป',
        );
      if (/disabled|has not been used/i.test(e.message))
        fail(
          422,
          'ยังไม่ได้เปิด Google Drive API ในโปรเจกต์ของแอป กรุณาเปิด API และตั้งสิทธิ์โฟลเดอร์ Shared Drive ก่อน',
        );
      fail(422, 'อัปโหลดเข้า Drive ไม่สำเร็จ กรุณาตรวจสิทธิ์โฟลเดอร์ FM และการเชื่อมบัญชี Google');
    }
  }
  async read(id) {
    return (
      await this.drive.files.get(
        { fileId: id, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' },
      )
    ).data;
  }
}
export class DashboardPhotos {
  constructor(adapter, store, editor) {
    this.adapter = adapter;
    this.store = store;
    this.editor = editor;
  }
  upload(row, revision, input) {
    const work = this.editor.queue.then(() => this.perform(row, revision, input));
    this.editor.queue = work.catch(() => {});
    return work;
  }
  async perform(row, revision, input) {
    const values = await this.adapter.readDashboard(),
      data = dashboardData(values),
      record = data.records.find((r) => r.row === row);
    if (!record || record.revision !== revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนเพิ่มรูป');
    if (data.records.filter((r) => r.revision === record.revision).length !== 1)
      fail(409, 'พบข้อมูลแถวซ้ำ กรุณาตรวจสอบก่อนเพิ่มรูป');
    const old = record.values[data.headers.indexOf(PHOTO_HEADER)] || '';
    if (photoIds(old).length >= 10) fail(400, 'รายการนี้มีครบ 10 รูปแล้ว');
    const buffer = await preparePhoto(input);
    const photo = await this.store.upload(
      buffer,
      `${record.asset.replace(/[^\w-]/g, '_')}_${Date.now()}.jpg`,
    );
    const fresh = dashboardData(await this.adapter.readDashboard()).records.find(
      (r) => r.row === row,
    );
    if (fresh?.revision !== record.revision)
      fail(409, `รูปอยู่ใน Drive แล้ว แต่ข้อมูลแถวเปลี่ยนจึงยังไม่ผูกกับชีต: ${photo.url}`);
    const at = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());
    try {
      await this.adapter.writeDashboardPhotos(
        row,
        [old, photo.url].filter(Boolean).join('\n'),
        at,
        this.store.publicPhotoPreview ? photo.id : null,
      );
    } catch {
      fail(
        409,
        `รูปอยู่ใน Drive แล้ว แต่บันทึกลิงก์ลงชีตไม่สำเร็จ กรุณาเก็บลิงก์นี้ไว้: ${photo.url}`,
      );
    }
    const saved = dashboardData(await this.adapter.readDashboard());
    const result = saved.records.find((r) => r.row === row);
    if (
      result?.asset !== record.asset ||
      !photoIds(result.values[saved.headers.indexOf(PHOTO_HEADER)]).includes(photo.id)
    )
      fail(409, `รูปอัปโหลดแล้วแต่ยืนยันในชีตไม่ได้: ${photo.url}`);
    return { url: photo.url, bytes: buffer.length, at };
  }
  async read(row, id) {
    const data = dashboardData(await this.adapter.readDashboard()),
      r = data.records.find((r) => r.row === row);
    if (!r || !photoIds(r.values[data.headers.indexOf(PHOTO_HEADER)]).includes(id))
      fail(404, 'ไม่พบรูปของรายการนี้');
    return this.store.read(id);
  }
}
