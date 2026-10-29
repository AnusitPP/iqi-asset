import { ReviewService } from '../review/service.js';
import { fingerprintRecord as fingerprint } from './revision.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { randomBytes } from 'node:crypto';
import { signToken, readToken } from '../../core/security/tokens.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { findRecords, inspectionDate, todayBangkok } from './search.js';
import { validateDropdownChanges } from './dropdowns.js';
import { recordSummary } from './summary.js';
import {
  SEARCH_STATUS_HEADER,
  PENDING_STATUS,
} from '../../../../shared/features/records/searchStatus.js';
import { reviewKey, INSPECTION_STATUSES } from '../review/queue.js';
import { IQI_IT_SHEET } from '../review/queues.js';
const labels = ['IQI', 'รายการทั้งหมด', 'all'];
export class Records {
  constructor(adapter, config) {
    this.adapter = adapter;
    this.config = config;
    this.tokenSecret = config.appSecret || randomBytes(32).toString('hex');
    this.queue = Promise.resolve();
    this.review = new ReviewService(this);
  }
  assertSheetAllowed(sheet) {
    if (!this.config.sheets.includes(sheet)) fail(403, 'ไม่อนุญาตให้อ่าน Sheet นี้');
  }
  createRecordRevision(table, record) {
    return signToken(
      {
        sheet: table.sheet,
        row: record.row,
        hash: fingerprint(table, record),
        expires: Date.now() + 30 * 60 * 1000,
      },
      this.tokenSecret,
    );
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
    const groups = tables.map((table, i) => {
      let { records, matchType } = query.trim()
        ? findRecords(table, query)
        : { records: table.records, matchType: 'all' };
      const statusIndex = table.headers.findIndex(
        (header) => header.trim() === SEARCH_STATUS_HEADER,
      );
      const pending = (sourceRecord) =>
        keys.has(reviewKey(table, sourceRecord)) ||
        (i === 0 && statusIndex >= 0 && sourceRecord.values[statusIndex] === PENDING_STATUS);
      if (pendingOnly) records = records.filter(pending);
      const field = (sourceRecord, names) =>
        sourceRecord.values[table.headers.findIndex((header) => names.includes(header.trim()))] ||
        '';
      return {
        sheet: table.sheet,
        label: labels[i],
        editable: i === 0,
        count: records.length,
        matchType,
        records: records.map((sourceRecord) => ({
          row: sourceRecord.row,
          sourceSheet: table.sheet,
          asset: sourceRecord.values[table.assetIndex],
          name: field(sourceRecord, ['รายการ', 'อุปกรณ์']),
          brand: field(sourceRecord, ['ยี่ห้อ', 'Brand']),
          ...recordSummary(table.headers, sourceRecord.values, this.config),
          pending: pending(sourceRecord),
          reviewSheet: destinations.get(reviewKey(table, sourceRecord)) || '',
          inspected: inspectedKeys.has(reviewKey(table, sourceRecord)),
          inspectionStatus: inspections.get(reviewKey(table, sourceRecord)) || '',
          revision: this.createRecordRevision(table, sourceRecord),
        })),
      };
    });
    const separate = groups.flatMap((g) =>
      g.records.filter((sourceRecord) => sourceRecord.reviewSheet === IQI_IT_SHEET),
    );
    if (separate.length || this.adapter.readReviewQueues) {
      for (const group of groups) {
        group.records = group.records.filter(
          (sourceRecord) => sourceRecord.reviewSheet !== IQI_IT_SHEET,
        );
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
  validateRecordRow(row) {
    if (!Number.isInteger(row) || row < 2 || row > 1000000) fail(400, 'เลขแถวไม่ถูกต้อง');
  }
  async detail(sheet, row) {
    this.assertSheetAllowed(sheet);
    this.validateRecordRow(row);
    const [table] = await this.adapter.read([sheet]);
    const record = table.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record) fail(404, 'ไม่พบแถวนี้ กรุณาค้นหาใหม่');
    return this.serializeRecord(table, record);
  }
  async serializeRecord(table, record) {
    const editable = table.sheet === this.config.sheets[0];
    let revision = null;
    const dropdowns =
      editable && this.adapter.getDropdowns
        ? await this.adapter.getDropdowns(table.sheet, record.row, table.headers.length)
        : [];
    if (editable) {
      revision = this.createRecordRevision(table, record);
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
    const work = this.queue.then(() =>
      writeLocked(this.adapter, () => this.saveRecordToSheet(row, body)),
    );
    this.queue = work.catch(() => {});
    return work;
  }
  setPending(row, body) {
    if (this.adapter.setReviewSelection)
      return this.setReviewPending(this.config.sheets[0], row, body);
    const work = this.queue.then(() =>
      writeLocked(this.adapter, () => this.saveRecordToSheet(row, body, { pending: body.pending })),
    );
    this.queue = work.catch(() => {});
    return work;
  }
  setReviewPending(sheet, row, body) {
    return this.review.setReviewPending(sheet, row, body);
  }
  reviewInspection(sheet, row, body, write = false) {
    return this.review.reviewInspection(sheet, row, body, write);
  }
  async saveRecordToSheet(row, body, statusUpdate) {
    this.validateRecordRow(row);
    if (body.sheet !== undefined && body.sheet !== this.config.sheets[0])
      fail(403, 'อนุญาตให้แก้ไขเฉพาะ IQI เท่านั้น');
    if (statusUpdate && typeof statusUpdate.pending !== 'boolean')
      fail(400, 'รูปแบบสถานะการค้นหาไม่ถูกต้อง');
    const snapshot = readToken(body.revision, this.tokenSecret);
    if (
      !snapshot ||
      snapshot.sheet !== this.config.sheets[0] ||
      snapshot.row !== row ||
      snapshot.expires < Date.now()
    )
      fail(409, 'ข้อมูลหมดอายุหรือไม่ตรงกัน กรุณาปิดรายละเอียดแล้วเปิดใหม่');
    const [table] = await this.adapter.read([this.config.sheets[0]]);
    const record = table.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record || fingerprint(table, record) !== snapshot.hash)
      fail(409, 'ข้อมูลหรือการเรียงแถวเปลี่ยนไป กรุณาปิดรายละเอียดแล้วค้นหาและเปิดใหม่ก่อนบันทึก');
    if (
      table.records.filter((sourceRecord) => fingerprint(table, sourceRecord) === snapshot.hash)
        .length !== 1
    )
      fail(
        409,
        'พบแถวที่มีข้อมูลเหมือนกันทุกช่อง จึงยังยืนยันแถวไม่ได้ กรุณาจัดการแถวซ้ำใน Google Sheets ก่อน',
      );
    const statusIndex = table.headers.findIndex((header) => header.trim() === SEARCH_STATUS_HEADER);
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
      body.values.some((fieldValue) => typeof fieldValue !== 'string' || fieldValue.length > 50000)
    )
      fail(400, 'จำนวนหรือรูปแบบข้อมูลไม่ตรงกับ column ปัจจุบัน');
    const changes = body.values.flatMap((value, index) =>
      value !== record.values[index] ? [{ index, value }] : [],
    );
    if (
      changes.some((c) => c.index === statusIndex && c.value !== '' && c.value !== PENDING_STATUS)
    )
      fail(422, 'สถานะการค้นหาต้องเป็น รอค้นหา หรือว่างเท่านั้น');
    if (!changes.length) return this.serializeRecord(table, record);
    const rules = this.adapter.getDropdowns
      ? await this.adapter.getDropdowns(table.sheet, row, table.headers.length)
      : [];
    validateDropdownChanges(changes, rules, table.headers);
    if (this.adapter.writeIQIAndReview)
      await this.adapter.writeIQIAndReview(table, record, changes);
    else await this.adapter.writeIQI(row, changes);
    // Always read the authoritative row back; never return submitted values as a saved record.
    const [freshTable] = await this.adapter.read([this.config.sheets[0]]);
    const fresh = freshTable.records.find((sourceRecord) => sourceRecord.row === row);
    if (
      !fresh ||
      JSON.stringify(freshTable.headers) !== JSON.stringify(table.headers) ||
      changes.some((c) => fresh.values[c.index] !== c.value)
    )
      fail(
        409,
        'ส่งคำสั่งบันทึกแล้ว แต่ยืนยันข้อมูลล่าสุดไม่ได้ กรุณาค้นหาใหม่เพื่อตรวจสอบก่อนบันทึกซ้ำ',
      );
    return this.serializeRecord(freshTable, fresh);
  }
}
