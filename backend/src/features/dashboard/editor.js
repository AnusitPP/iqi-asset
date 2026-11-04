import { formatBangkokInspectionTimestamp } from '../../../../shared/core/extensions/dates.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { dashboardData, DASHBOARD_DATE_HEADER } from './data.js';
import { normalizeAsset } from '../records/search.js';
import { editableDashboardHeaders } from '../../../../shared/features/records/dashboardFields.js';
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
  findIqiAsset(asset) {
    if (typeof asset !== 'string' || !asset.trim() || asset.length > 200)
      fail(400, 'กรุณาระบุเลขครุภัณฑ์ไม่เกิน 200 ตัวอักษร');
    return this.adapter.read(['IQI']).then(([table]) => {
      const assetColumns = table.headers.flatMap((header, index) =>
        header.trim() === 'เลขครุภัณฑ์' ? [index] : [],
      );
      if (assetColumns.length !== 1) fail(422, 'IQI ต้องมีคอลัมน์เลขครุภัณฑ์เพียงคอลัมน์เดียว');
      const matches = table.records.filter(
        (record) => normalizeAsset(record.values[assetColumns[0]]) === normalizeAsset(asset),
      );
      if (!matches.length) fail(404, 'ไม่พบเลขครุภัณฑ์นี้ใน IQI');
      if (matches.length !== 1) fail(409, 'พบเลขครุภัณฑ์ซ้ำใน IQI กรุณาตรวจสอบแถวต้นทาง');
      const source = matches[0].values;
      const get = (name) => {
        const indices = table.headers.flatMap((header, index) =>
          header.trim() === name ? [index] : [],
        );
        return indices.length === 1 ? source[indices[0]] || '' : '';
      };
      return {
        row: matches[0].row,
        asset: source[assetColumns[0]].trim(),
        name: get('รายการ'),
        brand: get('ยี่ห้อ'),
        model: get('รุ่น'),
        serial: get('Serial Number (S/N)'),
        owner: get('ชื่อ - นามสกุล') || get('ชื่อเล่น') || 'IT',
        team: get('ทีม'),
        details: get('รายละเอียด'),
        condition: get('สภาพ'),
        note: get('หมายเหตุ'),
      };
    });
  }
  addFromIqi(asset, expectedRow) {
    const work = this.queue.then(() =>
      writeLocked(this.adapter, async () => {
        const values = await this.adapter.readDashboard();
        const source = await this.findIqiAsset(asset);
        if (expectedRow !== undefined && source.row !== expectedRow)
          fail(409, 'ข้อมูล IQI เปลี่ยนไป กรุณาค้นหารายการนี้ใหม่');
        const headers = values[0] || [];
        const required = [
          'เลขครุภัณฑ์ในชีต',
          'ชื่ออุปกรณ์ในชีต',
          'ยี่ห้อ',
          'รุ่น',
          'S/N ในชีต',
          'ชื่อผู้ถือครอง',
          'ชื่อย่อ',
          'ชื่อเล่น',
          'ทีม',
          'รายละเอียดในชีต',
          'สภาพในชีต',
          'หมายเหตุเดิมในชีต',
          'แหล่งข้อมูลต้นฉบับ',
        ];
        if (required.some((name) => headers.filter((h) => h === name).length !== 1))
          fail(422, 'Appscriptdata ไม่มีคอลัมน์ที่ต้องใช้ครบถ้วน หรือมีชื่อคอลัมน์ซ้ำ');
        const targetAsset = source.asset;
        const assetColumn = headers.indexOf('เลขครุภัณฑ์ในชีต');
        const sourceColumn = headers.indexOf('แหล่งข้อมูลต้นฉบับ');
        if (
          values
            .slice(1)
            .some((row) =>
              [3, assetColumn].some(
                (index) => normalizeAsset(row[index]) === normalizeAsset(targetAsset),
              ),
            )
        )
          fail(409, 'เลขครุภัณฑ์นี้มีอยู่ใน Appscriptdata แล้ว');
        const mapping = {
          เลขครุภัณฑ์ในชีต: targetAsset,
          ชื่ออุปกรณ์ในชีต: source.name,
          ยี่ห้อ: source.brand,
          รุ่น: source.model,
          'S/N ในชีต': source.serial,
          ชื่อผู้ถือครอง: source.owner,
          ทีม: source.team,
          รายละเอียดในชีต: source.details,
          สภาพในชีต: source.condition,
          หมายเหตุเดิมในชีต: source.note,
          แหล่งข้อมูลต้นฉบับ: `IQI!แถว ${source.row}`,
        };
        const newRow = headers.map((header) => mapping[header] || '');
        if (!this.adapter.appendDashboardRow) fail(501, 'ยังไม่รองรับการเพิ่มแถวใน Appscriptdata');
        await this.adapter.appendDashboardRow(newRow);
        const fresh = await this.adapter.readDashboard();
        if (
          !fresh
            .slice(1)
            .some(
              (row) =>
                row[assetColumn] === targetAsset &&
                row[sourceColumn] === mapping['แหล่งข้อมูลต้นฉบับ'],
            )
        )
          fail(409, 'ส่งข้อมูลแล้วแต่ยืนยันผลไม่ได้ กรุณาโหลด Dashboard ใหม่ก่อนลองอีกครั้ง');
        return { asset: targetAsset };
      }),
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
    if (body.fields !== undefined) {
      if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields))
        fail(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
      for (const [header, value] of Object.entries(body.fields)) {
        if (!editableDashboardHeaders.includes(header)) fail(400, `ไม่อนุญาตให้แก้ไข ${header}`);
        if (typeof value !== 'string' || value.length > 5000)
          fail(400, 'ข้อมูลต้องไม่เกิน 5,000 ตัวอักษร');
        const column = data.headers.indexOf(header);
        if (column < 0 || data.headers.lastIndexOf(header) !== column)
          fail(422, `คอลัมน์ ${header} ไม่ถูกต้อง`);
        if (record.values[column] !== value) changes.push({ column, value });
      }
    }
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
    if (
      !Object.hasOwn(body, 'team') &&
      !Object.hasOwn(body, 'notes') &&
      !Object.hasOwn(body, 'fields')
    )
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
