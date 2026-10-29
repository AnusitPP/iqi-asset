import { formatBangkokTimestamp } from '../../../../shared/core/extensions/dates.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { dashboardData } from '../dashboard/data.js';
import { recordPhotos, MAX_PHOTOS, PHOTO_SLOTS } from '../../../../shared/features/photos/slots.js';
import { preparePhoto } from './prepareUpload.js';
export class DashboardPhotos {
  constructor(adapter, store, editor) {
    this.adapter = adapter;
    this.store = store;
    this.editor = editor;
  }
  upload(row, revision, input, type) {
    const work = this.editor.queue.then(() =>
      writeLocked(this.adapter, () => this.perform(row, revision, input, type)),
    );
    this.editor.queue = work.catch(() => {});
    return work;
  }
  async perform(row, revision, input, type) {
    if (type !== undefined) fail(400, 'กรุณาโหลดหน้าเว็บใหม่เพื่อใช้ช่องอัปโหลดรูปแบบรวม');
    const values = await this.adapter.readDashboard(),
      data = dashboardData(values),
      record = data.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record || record.revision !== revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนเพิ่มรูป');
    if (
      data.records.filter((sourceRecord) => sourceRecord.revision === record.revision).length !== 1
    )
      fail(409, 'พบข้อมูลแถวซ้ำ กรุณาตรวจสอบก่อนเพิ่มรูป');
    const old = recordPhotos(data.headers, record.values);
    if (old.length >= MAX_PHOTOS) fail(400, 'รายการนี้มีครบ 3 รูปแล้ว');
    const buffer = await preparePhoto(input);
    const photo = await this.store.upload(
      buffer,
      `${record.asset.replace(/[^\w-]/g, '_')}_photo${old.length + 1}_${Date.now()}.jpg`,
      record.asset,
    );
    const fresh = dashboardData(await this.adapter.readDashboard()).records.find(
      (sourceRecord) => sourceRecord.row === row,
    );
    if (fresh?.revision !== record.revision)
      fail(409, `รูปอยู่ใน Drive แล้ว แต่ข้อมูลแถวเปลี่ยนจึงยังไม่ผูกกับชีต: ${photo.url}`);
    const at = formatBangkokTimestamp();
    try {
      await this.adapter.writeDashboardPhotoSlots(row, [...old.map((p) => p.url), photo.url], at);
    } catch {
      fail(
        409,
        `รูปอยู่ใน Drive แล้ว แต่บันทึกลิงก์ลงชีตไม่สำเร็จ กรุณาเก็บลิงก์นี้ไว้: ${photo.url}`,
      );
    }
    const saved = dashboardData(await this.adapter.readDashboard());
    const result = saved.records.find((sourceRecord) => sourceRecord.row === row);
    if (
      result?.asset !== record.asset ||
      !PHOTO_SLOTS.some((header) => result.values[saved.headers.indexOf(header)] === photo.url)
    )
      fail(409, `รูปอัปโหลดแล้วแต่ยืนยันในชีตไม่ได้: ${photo.url}`);
    return { url: photo.url, bytes: buffer.length, at, revision: result.revision };
  }
  async read(row, id) {
    const data = dashboardData(await this.adapter.readDashboard()),
      sourceRecord = data.records.find((sourceRecord) => sourceRecord.row === row);
    if (
      !sourceRecord ||
      !recordPhotos(data.headers, sourceRecord.values).some((photo) => photo.id === id)
    )
      fail(404, 'ไม่พบรูปของรายการนี้');
    return this.store.read(id);
  }
}
