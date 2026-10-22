import { createHash, randomUUID } from 'node:crypto';
import { findRecords, inspectionDate, todayBangkok } from './searchService.js';
import { validateDropdownChanges } from './dropdowns.js';
import { recordSummary } from './recordSummary.js';
import { SEARCH_STATUS_HEADER, PENDING_STATUS } from './searchStatus.js';
import { reviewKey, INSPECTION_STATUSES } from './reviewQueue.js';
import { IQI_IT_SHEET } from './reviewQueues.js';
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const fingerprint = (table, record) =>
  createHash('sha256')
    .update(JSON.stringify([table.headers, table.headerRow, record.values, record.formulas]))
    .digest('hex');
const labels = ['IQI', 'รายการทั้งหมด', 'all'];
export class Records {
  constructor(adapter, config) {
    this.adapter = adapter;
    this.config = config;
    this.snapshots = new Map();
    this.queue = Promise.resolve();
  }
  allowed(sheet) {
    if (!this.config.sheets.includes(sheet)) fail(403, 'ไม่อนุญาตให้อ่าน Sheet นี้');
  }
  revisionFor(table, record) {
    const now = Date.now();
    if (!this.lastPrune || now - this.lastPrune > 60000) {
      for (const [id, snapshot] of this.snapshots)
        if (snapshot.expires < now) this.snapshots.delete(id);
      this.lastPrune = now;
    }
    if (this.snapshots.size >= (this.snapshotLimit || 2000))
      this.snapshots.delete(this.snapshots.keys().next().value);
    const revision = randomUUID();
    this.snapshots.set(revision, {
      sheet: table.sheet,
      row: record.row,
      hash: fingerprint(table, record),
      expires: now + 30 * 60 * 1000,
    });
    return revision;
  }
  async search(query, { pendingOnly = false } = {}) {
    if (typeof query !== 'string' || (!query.trim() && !pendingOnly) || query.length > 200)
      fail(400, 'กรุณาระบุคำค้นไม่เกิน 200 ตัวอักษร');
    const tables = await this.adapter.read();
    const queued = this.adapter.readReviewQueues
      ? await this.adapter.readReviewQueues()
      : this.adapter.readReviewQueue
        ? await this.adapter.readReviewQueue()
        : { entries: [] };
    const keys = new Set(queued.entries.map((entry) => entry.key));
    const inspections = new Map(
      queued.entries.map((entry) => [
        entry.key,
        entry.inspectionStatus ?? String(queued.rows?.[entry.row - 1]?.[13] || ''),
      ]),
    );
    const inspectedKeys = new Set(
      [...inspections]
        .filter(([, status]) => INSPECTION_STATUSES.includes(status))
        .map(([key]) => key),
    );
    const destinations = new Map(queued.entries.map((e) => [e.key, e.queueSheet || 'รอตรวจสอบ']));
    // Keep every token from the current IQI result, including sheets larger than
    // the normal rolling snapshot budget, plus room for opened detail panels.
    this.snapshotLimit = Math.max(
      2000,
      tables.reduce((total, t) => total + t.records.length, 0) + 100,
    );
    const groups = tables.map((table, i) => {
      let { records, matchType } = query.trim()
        ? findRecords(table, query)
        : { records: table.records, matchType: 'all' };
      const statusIndex = table.headers.findIndex((h) => h.trim() === SEARCH_STATUS_HEADER);
      const pending = (r) =>
        keys.has(reviewKey(table, r)) ||
        (i === 0 && statusIndex >= 0 && r.values[statusIndex] === PENDING_STATUS);
      if (pendingOnly) records = records.filter(pending);
      const field = (r, names) =>
        r.values[table.headers.findIndex((h) => names.includes(h.trim()))] || '';
      return {
        sheet: table.sheet,
        label: labels[i],
        editable: i === 0,
        count: records.length,
        matchType,
        records: records.map((r) => ({
          row: r.row,
          sourceSheet: table.sheet,
          asset: r.values[table.assetIndex],
          name: field(r, ['รายการ', 'อุปกรณ์']),
          brand: field(r, ['ยี่ห้อ', 'Brand']),
          ...recordSummary(table.headers, r.values, this.config),
          pending: pending(r),
          reviewSheet: destinations.get(reviewKey(table, r)) || '',
          inspected: inspectedKeys.has(reviewKey(table, r)),
          inspectionStatus: inspections.get(reviewKey(table, r)) || '',
          revision: this.revisionFor(table, r),
        })),
      };
    });
    const separate = groups.flatMap((g) => g.records.filter((r) => r.reviewSheet === IQI_IT_SHEET));
    if (separate.length || this.adapter.readReviewQueues) {
      for (const group of groups) {
        group.records = group.records.filter((r) => r.reviewSheet !== IQI_IT_SHEET);
        group.count = group.records.length;
      }
      groups.push({
        sheet: IQI_IT_SHEET,
        label: 'IT + IQI',
        editable: false,
        count: separate.length,
        matchType: 'partial',
        records: separate,
        reviewGroup: true,
      });
    }
    return { query: query.trim(), pendingOnly, groups };
  }
  validateRow(row) {
    if (!Number.isInteger(row) || row < 2 || row > 1000000) fail(400, 'เลขแถวไม่ถูกต้อง');
  }
  async detail(sheet, row) {
    this.allowed(sheet);
    this.validateRow(row);
    const [table] = await this.adapter.read([sheet]);
    const record = table.records.find((r) => r.row === row);
    if (!record) fail(404, 'ไม่พบแถวนี้ กรุณาค้นหาใหม่');
    return this.present(table, record);
  }
  async present(table, record) {
    const editable = table.sheet === this.config.sheets[0];
    let revision = null;
    const dropdowns =
      editable && this.adapter.getDropdowns
        ? await this.adapter.getDropdowns(table.sheet, record.row, table.headers.length)
        : [];
    if (editable) {
      revision = this.revisionFor(table, record);
    }
    return {
      sheet: table.sheet,
      label: labels[this.config.sheets.indexOf(table.sheet)],
      row: record.row,
      headers: table.headers,
      values: record.values,
      assetIndex: table.assetIndex,
      editable,
      revision,
      dropdowns,
      dateIndex: editable ? inspectionDate(table.headers, this.config.dateHeader) : null,
      dateMode: this.config.dateMode,
      today: todayBangkok(),
    };
  }
  save(row, body) {
    const work = this.queue.then(() => this.performSave(row, body));
    this.queue = work.catch(() => {});
    return work;
  }
  setPending(row, body) {
    if (this.adapter.setReviewSelection)
      return this.setReviewPending(this.config.sheets[0], row, body);
    const work = this.queue.then(() => this.performSave(row, body, { pending: body.pending }));
    this.queue = work.catch(() => {});
    return work;
  }
  setReviewPending(sheet, row, body) {
    const work = this.queue.then(() => this.performReviewPending(sheet, row, body));
    this.queue = work.catch(() => {});
    return work;
  }
  reviewInspection(sheet, row, body, write = false) {
    const work = this.queue.then(async () => {
      this.allowed(sheet);
      this.validateRow(row);
      const snapshot = this.snapshots.get(body.revision);
      if (
        !snapshot ||
        snapshot.sheet !== sheet ||
        snapshot.row !== row ||
        snapshot.expires < Date.now()
      )
        fail(409, 'ข้อมูลหมดอายุ กรุณาค้นหาใหม่');
      const [table] = await this.adapter.read([sheet]);
      const record = table.records.find((r) => r.row === row);
      if (!record || fingerprint(table, record) !== snapshot.hash)
        fail(409, 'ข้อมูลต้นฉบับเปลี่ยนไป กรุณาค้นหาใหม่');
      if (table.records.filter((r) => fingerprint(table, r) === snapshot.hash).length !== 1)
        fail(409, 'มีข้อมูลซ้ำที่ยืนยันรายการไม่ได้');
      return this.adapter.reviewInspection
        ? this.adapter.reviewInspection(table, record, write ? body : undefined)
        : this.adapter.reviewQueue.inspection(table, record, write ? body : undefined);
    });
    this.queue = work.catch(() => {});
    return work;
  }
  async performReviewPending(sheet, row, body) {
    this.allowed(sheet);
    this.validateRow(row);
    if (body.sheet !== undefined && body.sheet !== sheet) fail(403, 'แหล่งข้อมูลไม่ตรงกัน');
    if (typeof body.pending !== 'boolean') fail(400, 'รูปแบบสถานะไม่ถูกต้อง');
    const snapshot = this.snapshots.get(body.revision);
    if (
      !snapshot ||
      snapshot.sheet !== sheet ||
      snapshot.row !== row ||
      snapshot.expires < Date.now()
    )
      fail(409, 'ข้อมูลหมดอายุหรือแหล่งข้อมูลไม่ตรงกัน กรุณาค้นหาใหม่');
    const [table] = await this.adapter.read([sheet]);
    const record = table.records.find((r) => r.row === row);
    if (!record || fingerprint(table, record) !== snapshot.hash)
      fail(409, 'ข้อมูลหรือการเรียงแถวเปลี่ยนไป กรุณาค้นหาใหม่ก่อนส่งไปรอตรวจสอบ');
    const key = reviewKey(table, record);
    if (table.records.filter((r) => reviewKey(table, r) === key).length !== 1)
      fail(409, 'มีแถวที่เหมือนกันทุกช่อง จึงยังยืนยันรายการไม่ได้ กรุณาตรวจสอบแถวซ้ำในชีต');
    const result = await this.adapter.setReviewSelection(table, record, body.pending);
    this.snapshots.delete(body.revision);
    const [freshTable] = await this.adapter.read([sheet]);
    const fresh = freshTable.records.find((r) => r.row === row);
    if (!fresh || reviewKey(freshTable, fresh) !== key)
      fail(409, 'ส่งข้อมูลแล้ว แต่แถวต้นฉบับเปลี่ยนไป กรุณาค้นหาใหม่เพื่อตรวจสอบ');
    const statusIndex = freshTable.headers.findIndex((h) => h.trim() === SEARCH_STATUS_HEADER);
    if (
      sheet === this.config.sheets[0] &&
      statusIndex >= 0 &&
      fresh.values[statusIndex] !== (body.pending ? PENDING_STATUS : '')
    )
      fail(409, 'ยืนยันสถานะ IQI ไม่ได้ กรุณาค้นหาใหม่');
    const presented = await this.present(freshTable, fresh);
    return {
      ...presented,
      revision: presented.revision || this.revisionFor(freshTable, fresh),
      pending: result.pending,
      reviewUrl: result.reviewUrl,
      reviewSheet: result.reviewSheet,
    };
  }
  async performSave(row, body, statusUpdate) {
    this.validateRow(row);
    if (body.sheet !== undefined && body.sheet !== this.config.sheets[0])
      fail(403, 'อนุญาตให้แก้ไขเฉพาะ IQI เท่านั้น');
    if (statusUpdate && typeof statusUpdate.pending !== 'boolean')
      fail(400, 'รูปแบบสถานะการค้นหาไม่ถูกต้อง');
    const snapshot = this.snapshots.get(body.revision);
    if (
      !snapshot ||
      snapshot.sheet !== this.config.sheets[0] ||
      snapshot.row !== row ||
      snapshot.expires < Date.now()
    )
      fail(409, 'ข้อมูลหมดอายุหรือไม่ตรงกัน กรุณาปิดรายละเอียดแล้วเปิดใหม่');
    const [table] = await this.adapter.read([this.config.sheets[0]]);
    const record = table.records.find((r) => r.row === row);
    if (!record || fingerprint(table, record) !== snapshot.hash)
      fail(409, 'ข้อมูลหรือการเรียงแถวเปลี่ยนไป กรุณาปิดรายละเอียดแล้วค้นหาและเปิดใหม่ก่อนบันทึก');
    if (table.records.filter((r) => fingerprint(table, r) === snapshot.hash).length !== 1)
      fail(
        409,
        'พบแถวที่มีข้อมูลเหมือนกันทุกช่อง จึงยังยืนยันแถวไม่ได้ กรุณาจัดการแถวซ้ำใน Google Sheets ก่อน',
      );
    const statusIndex = table.headers.findIndex((h) => h.trim() === SEARCH_STATUS_HEADER);
    if (statusUpdate) {
      if (statusIndex < 0)
        fail(422, 'ยังไม่มีคอลัมน์สถานะการค้นหาใน IQI กรุณาเริ่มเซิร์ฟเวอร์ใหม่');
      const values = [...record.values];
      values[statusIndex] = statusUpdate.pending ? PENDING_STATUS : '';
      body = { ...body, values };
    }
    if (
      !Array.isArray(body.values) ||
      body.values.length !== table.headers.length ||
      body.values.some((v) => typeof v !== 'string' || v.length > 50000)
    )
      fail(400, 'จำนวนหรือรูปแบบข้อมูลไม่ตรงกับ column ปัจจุบัน');
    const changes = body.values.flatMap((value, index) =>
      value !== record.values[index] ? [{ index, value }] : [],
    );
    if (
      changes.some((c) => c.index === statusIndex && c.value !== '' && c.value !== PENDING_STATUS)
    )
      fail(422, 'สถานะการค้นหาต้องเป็น รอค้นหา หรือว่างเท่านั้น');
    if (!changes.length) return this.present(table, record);
    const rules = this.adapter.getDropdowns
      ? await this.adapter.getDropdowns(table.sheet, row, table.headers.length)
      : [];
    validateDropdownChanges(changes, rules, table.headers);
    if (this.adapter.writeIQIAndReview)
      await this.adapter.writeIQIAndReview(table, record, changes);
    else await this.adapter.writeIQI(row, changes);
    this.snapshots.delete(body.revision);
    // Always read the authoritative row back; never return submitted values as a saved record.
    const [freshTable] = await this.adapter.read([this.config.sheets[0]]);
    const fresh = freshTable.records.find((r) => r.row === row);
    if (
      !fresh ||
      JSON.stringify(freshTable.headers) !== JSON.stringify(table.headers) ||
      changes.some((c) => fresh.values[c.index] !== c.value)
    )
      fail(
        409,
        'ส่งคำสั่งบันทึกแล้ว แต่ยืนยันข้อมูลล่าสุดไม่ได้ กรุณาค้นหาใหม่เพื่อตรวจสอบก่อนบันทึกซ้ำ',
      );
    return this.present(freshTable, fresh);
  }
}
