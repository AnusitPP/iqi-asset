import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { driveOAuth } from './driveAuth.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
export class PhotoStore {
  constructor(config) {
    this.folder = config.photoFolderId || '1C42KW3QDHJ2X4scDba0p11TV1xM4L8-z';
    this.userAuth = Boolean(config.driveOAuthCredentials || config.driveOAuthFile);
    this.publicPhotoPreview = config.publicPhotoPreview === true;
    let auth;
    this.oauthConnected = true;
    if (this.userAuth) {
      const connection = driveOAuth(config.driveOAuthCredentials || config.driveOAuthFile);
      auth = connection.auth;
      this.oauthConnected = connection.connected;
    } else
      auth = new google.auth.GoogleAuth({
        ...(config.serviceAccount
          ? { credentials: config.serviceAccount }
          : { keyFile: config.keyFile }),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    this.drive = google.drive({ version: 'v3', auth, timeout: 20000 });
    this.folderRequests = new Map();
  }
  async assetFolder(asset) {
    const name = String(asset || '').trim();
    if (!name) fail(422, 'ไม่พบเลขครุภัณฑ์สำหรับสร้างโฟลเดอร์รูป');
    if (this.folderRequests.has(name)) return this.folderRequests.get(name);
    const work = (async () => {
      const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const { data } = await this.drive.files.list({
        q: `'${escape(this.folder)}' in parents and name = '${escape(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 100,
        fields: 'files(id),nextPageToken',
      });
      if (data.files.length > 1 || data.nextPageToken)
        fail(422, 'พบโฟลเดอร์เลขครุภัณฑ์ซ้ำ กรุณาตรวจสอบใน Google Drive');
      if (data.files.length) return data.files[0].id;
      const created = await this.drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.folder],
        },
        fields: 'id',
      });
      return created.data.id;
    })();
    this.folderRequests.set(name, work);
    try {
      return await work;
    } finally {
      this.folderRequests.delete(name);
    }
  }
  async upload(buffer, name, asset) {
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
      const parent = await this.assetFolder(asset);
      const file = (
        await this.drive.files.create({
          supportsAllDrives: true,
          requestBody: { name, mimeType: 'image/jpeg', parents: [parent] },
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
        } catch {
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
