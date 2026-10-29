import { FORM_TEAMS, LOAN_TYPES, RETURN_TYPES } from '../../../shared/loanForm.js';
import { randomUUID, createHash } from 'node:crypto';
import { readyToBorrowData } from './readyToBorrow.js';
export const LOAN_HEADERS = [
  'เลขรายการยืม',
  'รหัสรายการอุปกรณ์ยืม',
  'ประทับเวลา',
  'ชื่อ - สกุล',
  'ทีม',
  'ประเภทคำร้องขอ',
  'ประเภทอุปกรณ์',
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'เหตุผล หรือวัตถุประสงค์',
  'วันที่ต้องการยืม',
  'กำหนดวันส่งคืน',
  'หมายเหตุ',
  'สถานะ',
  'ผู้รับผิดชอบ',
  'รายละเอียด',
  'รหัสคำขอ',
  'ลายนิ้วมือคำขอ',
];
export const RETURN_HEADERS = [
  'เลขรายการคืน',
  'เลขรายการยืม',
  'รหัสรายการอุปกรณ์ยืม',
  'ประทับเวลา',
  'ชื่อผู้คืน',
  'ทีม',
  'ประเภทคำร้องขอ',
  'ประเภทอุปกรณ์',
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'วันที่ส่งคืน',
  'หมายเหตุ',
  'สภาพหลังคืน',
  'สถานะรับคืน',
  'ผู้รับผิดชอบ',
  'รายละเอียด',
  'รหัสคำขอ',
  'ลายนิ้วมือคำขอ',
];
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, max = 200, required = true) => {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    fail(400, 'ข้อมูลไม่ครบหรือยาวเกินกำหนด');
  return v.trim();
};
const date = (v) => {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(400, 'วันที่ไม่ถูกต้อง');
  return v;
};
const key = (r) => JSON.stringify([r.asset, r.serial]);
const fingerprint = (b) => createHash('sha256').update(JSON.stringify(b)).digest('hex');
const now = () =>
  new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date());
const category = (name) =>
  /keyboard|คีย์บอร์ด/i.test(name)
    ? 'Keyboard'
    : /printer|เครื่องพิมพ์|เครื่องปริ้น/i.test(name)
      ? 'Printer'
      : /monitor|จอมอนิเตอร์/i.test(name)
        ? 'Monitor'
        : /mouse|เมาส์/i.test(name)
          ? 'Mouse'
          : /laptop|notebook|พกพา/i.test(name)
            ? 'Laptop'
            : 'Desktop';
function table(values, headers) {
  if (JSON.stringify(values[0]) !== JSON.stringify(headers))
    fail(422, 'หัวคอลัมน์ชีตยืม–คืนไม่ตรง กรุณาตรวจสอบ');
  return values.slice(1).filter((r) => r[0]);
}
export class Loans {
  constructor(adapter, config = {}) {
    this.adapter = adapter;
    this.config = config;
    this.queue = Promise.resolve();
  }
  async state() {
    const d = await this.adapter.readLoanSheets();
    const loans = table(d.loans, LOAN_HEADERS),
      returns = table(d.returns, RETURN_HEADERS);
    const returned = new Set(returns.filter((r) => r[14] === 'รับคืนแล้ว').map((r) => r[2]));
    return { loans, returns, active: loans.filter((r) => !returned.has(r[1])) };
  }
  async available() {
    const [data, s] = await Promise.all([this.adapter.readReadyToBorrow(), this.state()]);
    const blocked = new Set(s.active.map((r) => key({ asset: r[7], serial: r[8] || '' })));
    const latest = new Map();
    for (const r of s.returns.filter((r) => r[14] === 'รับคืนแล้ว'))
      latest.set(key({ asset: r[8], serial: r[9] || '' }), r[13]);
    return {
      records: readyToBorrowData(data).records.filter(
        (r) => !blocked.has(key(r)) && (!latest.has(key(r)) || latest.get(key(r)) === 'ดี'),
      ),
    };
  }
  async outstanding() {
    const s = await this.state();
    return {
      records: s.active.map((r) => ({
        loanId: r[0],
        itemId: r[1],
        borrower: r[3],
        team: r[4],
        category: r[6],
        asset: r[7],
        serial: r[8] || '',
        name: r[9],
        start: r[11],
        due: r[12],
      })),
    };
  }
  locked(work) {
    if (this.config.hosted)
      fail(
        503,
        'การบันทึกยืม–คืนต้องใช้เซิร์ฟเวอร์เดียว ขณะนี้เปิดให้บันทึกผ่าน localhost เท่านั้น',
      );
    const job = this.queue.catch(() => {}).then(work);
    this.queue = job.catch(() => {});
    return job;
  }
  formBody(body, types) {
    const b = {
      requestId: text(body.requestId, 100),
      borrower: text(body.borrower),
      team: text(body.team),
      category: text(body.category),
      identifier: text(body.identifier, 500),
      notes: text(body.notes ?? '', 2000, false),
    };
    if (
      !/^[\w-]{8,100}$/.test(b.requestId) ||
      !FORM_TEAMS.includes(b.team) ||
      !types.includes(b.category)
    )
      fail(400, 'กรุณาเลือกทีมและประเภทจากรายการ');
    return b;
  }
  borrowForm(body) {
    return this.locked(async () => {
      const b = {
        ...this.formBody(body, LOAN_TYPES),
        purpose: text(body.purpose, 500),
        start: date(body.start),
        due: date(body.due),
      };
      if (b.due < b.start || (Date.parse(b.due) - Date.parse(b.start)) / 86400000 > 7)
        fail(400, 'กำหนดคืนต้องไม่ก่อนวันที่ยืมและไม่เกิน 7 วัน');
      const hash = fingerprint(b),
        s = await this.state(),
        existing = s.loans.filter((r) => r[17] === b.requestId);
      if (existing.length) {
        if (existing.some((r) => r[18] !== hash)) fail(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
        return { id: existing[0][0], unchanged: true };
      }
      if (
        b.identifier !== '-' &&
        s.active.some((r) => r[7] === b.identifier || r[8] === b.identifier)
      )
        fail(409, 'อุปกรณ์นี้มีรายการยืมค้างอยู่');
      const id = 'L-' + randomUUID();
      await this.adapter.appendLoanRows('loans', [
        [
          id,
          randomUUID(),
          now(),
          b.borrower,
          b.team,
          'ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ',
          b.category,
          b.identifier,
          '',
          '',
          b.purpose,
          b.start,
          b.due,
          b.notes,
          'รอดำเนินการ',
          '',
          '',
          b.requestId,
          hash,
        ],
      ]);
      if (!(await this.state()).loans.some((r) => r[17] === b.requestId && r[18] === hash))
        fail(502, 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม');
      return { id };
    });
  }
  returnForm(body) {
    return this.locked(async () => {
      const b = { ...this.formBody(body, RETURN_TYPES), date: date(body.date) };
      const hash = fingerprint(b),
        s = await this.state(),
        existing = s.returns.filter((r) => r[17] === b.requestId);
      if (existing.length) {
        if (existing.some((r) => r[18] !== hash)) fail(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
        return { id: existing[0][0], unchanged: true };
      }
      const id = 'R-' + randomUUID();
      await this.adapter.appendLoanRows('returns', [
        [
          id,
          '',
          '',
          now(),
          b.borrower,
          b.team,
          'ส่วนที่ 5 : คืนครุภัณฑ์คอมพิวเตอร์ หรือคืนวัสดุด้านเทคโนโลยีสารสนเทศ',
          b.category,
          b.identifier,
          '',
          '',
          b.date,
          b.notes,
          '',
          'รอรับคืน',
          '',
          '',
          b.requestId,
          hash,
        ],
      ]);
      if (!(await this.state()).returns.some((r) => r[17] === b.requestId && r[18] === hash))
        fail(502, 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม');
      return { id };
    });
  }
  borrow(body) {
    return this.locked(async () => {
      const requestId = text(body.requestId, 100);
      if (!/^[\w-]{8,100}$/.test(requestId)) fail(400, 'รหัสคำขอไม่ถูกต้อง');
      const b = {
        requestId,
        borrower: text(body.borrower),
        team: text(body.team),
        purpose: text(body.purpose, 500),
        start: date(body.start),
        due: date(body.due),
        notes: text(body.notes ?? '', 2000, false),
      };
      if (b.due < b.start || (Date.parse(b.due) - Date.parse(b.start)) / 86400000 > 7)
        fail(400, 'กำหนดคืนต้องอยู่ระหว่างวันยืมถึงไม่เกิน 7 วัน');
      if (!Array.isArray(body.items) || !body.items.length || body.items.length > 5)
        fail(400, 'เลือกครุภัณฑ์ 1–5 รายการ');
      b.items = body.items.map((r) => ({
        asset: text(r?.asset),
        serial: text(r?.serial ?? '', 200, false),
      }));
      if (new Set(b.items.map(key)).size !== b.items.length) fail(400, 'รายการครุภัณฑ์ซ้ำ');
      const hash = fingerprint(b),
        s = await this.state();
      const existing = s.loans.filter((r) => r[17] === requestId);
      if (existing.length) {
        if (existing.some((r) => r[18] !== hash)) fail(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
        return {
          id: existing[0][0],
          items: existing.map((r) => ({ itemId: r[1] })),
          unchanged: true,
        };
      }
      const available = (await this.available()).records;
      const items = b.items.map((r) => {
        const found = available.filter((x) => key(x) === key(r));
        if (found.length !== 1) fail(409, 'อุปกรณ์ไม่พร้อมยืมหรือข้อมูลซ้ำ กรุณาโหลดใหม่');
        return found[0];
      });
      const id = 'L-' + randomUUID(),
        stamp = now();
      const rows = items.map((r) => [
        id,
        randomUUID(),
        stamp,
        b.borrower,
        b.team,
        '1 ยืมครุภัณฑ์',
        category(r.name),
        r.asset,
        r.serial,
        r.name,
        b.purpose,
        b.start,
        b.due,
        b.notes,
        'กำลังยืม',
        '',
        '',
        requestId,
        hash,
      ]);
      await this.adapter.appendLoanRows('loans', rows);
      const fresh = await this.state();
      if (fresh.loans.filter((r) => r[17] === requestId).length !== rows.length)
        fail(502, 'ยืนยันการบันทึกไม่ได้ กรุณาลองซ้ำด้วยคำขอเดิม');
      return { id, items: rows.map((r) => ({ itemId: r[1] })) };
    });
  }
  returnItems(body) {
    return this.locked(async () => {
      const b = {
        requestId: text(body.requestId, 100),
        borrower: text(body.borrower),
        date: date(body.date),
        condition: text(body.condition),
        notes: text(body.notes ?? '', 2000, false),
        staff: text(body.staff),
      };
      if (!/^[\w-]{8,100}$/.test(b.requestId) || !['ดี', 'ชำรุด'].includes(b.condition))
        fail(400, 'ข้อมูลรับคืนไม่ถูกต้อง');
      if (!Array.isArray(body.itemIds) || !body.itemIds.length || body.itemIds.length > 5)
        fail(400, 'เลือกรายการคืน 1–5 ชิ้น');
      b.itemIds = body.itemIds.map((v) => text(v, 100));
      if (new Set(b.itemIds).size !== b.itemIds.length) fail(400, 'รายการคืนซ้ำ');
      const hash = fingerprint(b),
        s = await this.state(),
        existing = s.returns.filter((r) => r[17] === b.requestId);
      if (existing.length) {
        if (existing.some((r) => r[18] !== hash)) fail(409, 'รหัสคำขอถูกใช้แล้ว');
        return { id: existing[0][0], unchanged: true };
      }
      const items = b.itemIds.map((id) => {
        const r = s.active.find((r) => r[1] === id);
        if (!r) fail(409, 'รายการนี้คืนแล้วหรือไม่พบรายการยืม');
        if (b.date < r[11]) fail(400, 'วันคืนต้องไม่ก่อนวันยืม');
        return r;
      });
      const id = 'R-' + randomUUID(),
        stamp = now();
      await this.adapter.appendLoanRows(
        'returns',
        items.map((r) => [
          id,
          r[0],
          r[1],
          stamp,
          b.borrower,
          r[4],
          '5 คืนครุภัณฑ์',
          r[6],
          r[7],
          r[8] || '',
          r[9],
          b.date,
          b.notes,
          b.condition,
          'รับคืนแล้ว',
          b.staff,
          '',
          b.requestId,
          hash,
        ]),
      );
      const fresh = await this.state();
      if (fresh.returns.filter((r) => r[17] === b.requestId).length !== items.length)
        fail(502, 'ยืนยันรับคืนไม่ได้ กรุณาลองด้วยคำขอเดิม');
      return { id };
    });
  }
}
