import { formatBangkokInspectionTimestamp } from '../../../../shared/core/extensions/dates.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { dashboardData, DASHBOARD_DATE_HEADER } from './data.js';
export { dashboardData, DASHBOARD_DATE_HEADER } from './data.js';
export class DashboardEditor {
  constructor(adapter) {
    this.adapter = adapter;
    this.queue = Promise.resolve();
  }
  save(row, body) {
    const work = this.queue.then(() =>
      writeLocked(this.adapter, () => this.performSave(row, body)),
    );
    this.queue = work.catch(() => {});
    return work;
  }
  saveDetails(row, body) {
    const work = this.queue.then(() =>
      writeLocked(this.adapter, () => this.performDetails(row, body)),
    );
    this.queue = work.catch(() => {});
    return work;
  }
  async performDetails(row, body) {
    if (!Number.isInteger(row) || row < 2 || row > 5000) fail(400, 'เลขแถวไม่ถูกต้อง');
    const data = dashboardData(await this.adapter.readDashboard());
    const record = data.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record || record.revision !== body.revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่');
    if (
      data.records.filter((sourceRecord) => sourceRecord.revision === record.revision).length !== 1
    )
      fail(409, 'พบข้อมูลแถวซ้ำ กรุณาตรวจสอบก่อนบันทึก');
    const changes = [];
    for (const [key, header] of [
      ['team', 'ทีม'],
      ['notes', 'หมายเหตุ'],
    ]) {
      if (!Object.hasOwn(body, key)) continue;
      const value = body[key];
      if (typeof value !== 'string' || value.length > (key === 'team' ? 200 : 5000))
        fail(400, key === 'team' ? 'ทีมไม่ถูกต้อง' : 'หมายเหตุต้องไม่เกิน 5,000 ตัวอักษร');
      if (key === 'team' && value !== '' && !data.teams.includes(value))
        fail(400, 'กรุณาเลือกทีมจากรายการ');
      const column = data.headers.indexOf(header);
      if (column < 0 || data.headers.lastIndexOf(header) !== column)
        fail(422, `ไม่พบคอลัมน์ ${header} หรือมีคอลัมน์ซ้ำ`);
      if (record.values[column] !== value) changes.push({ column, value });
    }
    if (!Object.hasOwn(body, 'team') && !Object.hasOwn(body, 'notes'))
      fail(400, 'ไม่พบข้อมูลที่ต้องการแก้ไข');
    if (!changes.length) return { record, unchanged: true };
    await this.adapter.writeDashboardDetails(row, changes);
    const fresh = dashboardData(await this.adapter.readDashboard());
    const saved = fresh.records.find((sourceRecord) => sourceRecord.row === row);
    if (
      !saved ||
      saved.asset !== record.asset ||
      saved.serial !== record.serial ||
      changes.some((c) => saved.values[c.column] !== c.value)
    )
      fail(409, 'ส่งข้อมูลแล้วแต่ยืนยันผลไม่ได้ กรุณาโหลดข้อมูลล่าสุด');
    return { record: saved, unchanged: false };
  }
  async performSave(row, body) {
    if (!Number.isInteger(row) || row < 2 || row > 5000) fail(400, 'เลขแถวไม่ถูกต้อง');
    if (
      !['ดี', 'ชำรุด', 'หาไม่เจอ', 'ยังไม่ตรวจ', 'อุปกรอื่นๆ', 'กล้องวงจรปิด'].includes(body.status)
    )
      fail(400, 'กรุณาเลือกสถานะที่ถูกต้อง');
    const values = await this.adapter.readDashboard(),
      data = dashboardData(values),
      record = data.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record || typeof body.revision !== 'string' || record.revision !== body.revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่');
    if (
      data.records.filter((sourceRecord) => sourceRecord.revision === record.revision).length !== 1
    )
      fail(409, 'พบแถวที่เหมือนกันทุกช่อง กรุณาตรวจสอบก่อนบันทึก');
    if (record.inspection === body.status) return { record, unchanged: true };
    let dateColumn = data.headers.indexOf(DASHBOARD_DATE_HEADER);
    const addHeader = dateColumn < 0;
    if (addHeader) dateColumn = Math.max(...values.map((sourceRecord) => sourceRecord.length));
    const date = formatBangkokInspectionTimestamp();
    await this.adapter.writeDashboardStatus(
      row,
      data.headers.indexOf('ผลตรวจ Apps Script'),
      dateColumn,
      body.status,
      date,
      addHeader,
    );
    const fresh = dashboardData(await this.adapter.readDashboard()),
      saved = fresh.records.find((sourceRecord) => sourceRecord.row === row);
    if (
      !saved ||
      saved.asset !== record.asset ||
      saved.serial !== record.serial ||
      saved.inspection !== body.status ||
      saved.updatedAt !== date
    )
      fail(409, 'ส่งข้อมูลแล้วแต่ยืนยันผลไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกซ้ำ');
    return { record: saved, unchanged: false };
  }
}
