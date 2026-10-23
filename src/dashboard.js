import { createHash } from 'node:crypto';
const revision = (headers, row) =>
  createHash('sha256')
    .update(JSON.stringify([headers, headers.map((_, i) => String(row[i] ?? ''))]))
    .digest('hex');
export const DASHBOARD_DATE_HEADER = 'อัปเดตสถานะล่าสุด';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export class DashboardEditor {
  constructor(adapter) {
    this.adapter = adapter;
    this.queue = Promise.resolve();
  }
  save(row, body) {
    const work = this.queue.then(() => this.performSave(row, body));
    this.queue = work.catch(() => {});
    return work;
  }
  saveDetails(row, body) {
    const work = this.queue.then(() => this.performDetails(row, body));
    this.queue = work.catch(() => {});
    return work;
  }
  async performDetails(row, body) {
    if (!Number.isInteger(row) || row < 2 || row > 5000) fail(400, 'เลขแถวไม่ถูกต้อง');
    const data = dashboardData(await this.adapter.readDashboard());
    const record = data.records.find((r) => r.row === row);
    if (!record || record.revision !== body.revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่');
    if (data.records.filter((r) => r.revision === record.revision).length !== 1)
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
    const saved = fresh.records.find((r) => r.row === row);
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
      record = data.records.find((r) => r.row === row);
    if (!record || typeof body.revision !== 'string' || record.revision !== body.revision)
      fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกใหม่');
    if (data.records.filter((r) => r.revision === record.revision).length !== 1)
      fail(409, 'พบแถวที่เหมือนกันทุกช่อง กรุณาตรวจสอบก่อนบันทึก');
    if (record.inspection === body.status) return { record, unchanged: true };
    let dateColumn = data.headers.indexOf(DASHBOARD_DATE_HEADER);
    const addHeader = dateColumn < 0;
    if (addHeader) dateColumn = Math.max(...values.map((r) => r.length));
    const date = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    await this.adapter.writeDashboardStatus(
      row,
      data.headers.indexOf('ผลตรวจ Apps Script'),
      dateColumn,
      body.status,
      date,
      addHeader,
    );
    const fresh = dashboardData(await this.adapter.readDashboard()),
      saved = fresh.records.find((r) => r.row === row);
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
export function dashboardData(values = []) {
  const headers = (values[0] || []).map(String);
  for (const name of ['ผลตรวจ Apps Script', 'สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script'])
    if (!headers.includes(name))
      throw Object.assign(new Error(`Appscriptdata: ไม่พบคอลัมน์ ${name}`), { status: 422 });
  const records = values.slice(1).flatMap((row, index) => {
    const get = (name) => String(row[headers.indexOf(name)] ?? '').trim();
    if (!get('เลขครุภัณฑ์ Apps Script')) return [];
    const status = get('ผลตรวจ Apps Script');
    return [
      {
        row: index + 2,
        revision: revision(headers, row),
        updatedAt: get(DASHBOARD_DATE_HEADER),
        asset: get('เลขครุภัณฑ์ Apps Script'),
        name: get('ชื่ออุปกรณ์ Apps Script'),
        serial: get('S/N Apps Script'),
        inspection: [
          'ดี',
          'ชำรุด',
          'หาไม่เจอ',
          'ยังไม่ตรวจ',
          'อุปกรอื่นๆ',
          'กล้องวงจรปิด',
        ].includes(status)
          ? status
          : 'ไม่ระบุ',
        comparison: get('สถานะการเทียบ') || 'ไม่ระบุ',
        owner: get('ชื่อผู้ถือครอง'),
        team: get('ทีม'),
        notes: get('หมายเหตุการเทียบข้อมูล'),
        editableNotes: String(row[headers.indexOf('หมายเหตุ')] ?? ''),
        values: headers.map((_, i) => String(row[i] ?? '')),
      },
    ];
  });
  const inspection = {
      ดี: 0,
      ชำรุด: 0,
      หาไม่เจอ: 0,
      ยังไม่ตรวจ: 0,
      อุปกรอื่นๆ: 0,
      กล้องวงจรปิด: 0,
      ไม่ระบุ: 0,
    },
    comparison = {};
  for (const r of records) {
    inspection[r.inspection]++;
    comparison[r.comparison] = (comparison[r.comparison] || 0) + 1;
  }
  const total = records.length,
    completed =
      inspection['ดี'] +
      inspection['ชำรุด'] +
      inspection['หาไม่เจอ'] +
      inspection['อุปกรอื่นๆ'] +
      inspection['กล้องวงจรปิด'];
  return {
    headers,
    teams: [...new Set(records.map((r) => r.team).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'th'),
    ),
    records,
    total,
    completed,
    percent: total ? Math.round((completed / total) * 10000) / 100 : 0,
    inspection,
    comparison,
    loadedAt: new Date().toISOString(),
  };
}
