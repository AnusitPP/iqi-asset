import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { readToken } from '../../core/security/tokens.js';
import { fingerprintRecord as fingerprint } from '../records/revision.js';
import { reviewKey } from './queue.js';
import {
  SEARCH_STATUS_HEADER,
  PENDING_STATUS,
} from '../../../../shared/features/records/searchStatus.js';
export class ReviewService {
  constructor(records) {
    this.records = records;
  }
  setReviewPending(sheet, row, body) {
    const work = this.records.queue.then(() =>
      writeLocked(this.records.adapter, () => this.performReviewPending(sheet, row, body)),
    );
    this.records.queue = work.catch(() => {});
    return work;
  }
  reviewInspection(sheet, row, body, write = false) {
    const work = this.records.queue.then(() =>
      writeLocked(this.records.adapter, async () => {
        this.records.assertSheetAllowed(sheet);
        this.records.validateRecordRow(row);
        const snapshot = readToken(body.revision, this.records.tokenSecret);
        if (
          !snapshot ||
          snapshot.sheet !== sheet ||
          snapshot.row !== row ||
          snapshot.expires < Date.now()
        )
          fail(409, 'ข้อมูลหมดอายุ กรุณาค้นหาใหม่');
        const [table] = await this.records.adapter.read([sheet]);
        const record = table.records.find((sourceRecord) => sourceRecord.row === row);
        if (!record || fingerprint(table, record) !== snapshot.hash)
          fail(409, 'ข้อมูลต้นฉบับเปลี่ยนไป กรุณาค้นหาใหม่');
        if (
          table.records.filter((sourceRecord) => fingerprint(table, sourceRecord) === snapshot.hash)
            .length !== 1
        )
          fail(409, 'มีข้อมูลซ้ำที่ยืนยันรายการไม่ได้');
        return this.records.adapter.reviewInspection
          ? this.records.adapter.reviewInspection(table, record, write ? body : undefined)
          : this.records.adapter.reviewQueue.inspection(table, record, write ? body : undefined);
      }),
    );
    this.records.queue = work.catch(() => {});
    return work;
  }
  async performReviewPending(sheet, row, body) {
    this.records.assertSheetAllowed(sheet);
    this.records.validateRecordRow(row);
    if (body.sheet !== undefined && body.sheet !== sheet) fail(403, 'แหล่งข้อมูลไม่ตรงกัน');
    if (typeof body.pending !== 'boolean') fail(400, 'รูปแบบสถานะไม่ถูกต้อง');
    const snapshot = readToken(body.revision, this.records.tokenSecret);
    if (
      !snapshot ||
      snapshot.sheet !== sheet ||
      snapshot.row !== row ||
      snapshot.expires < Date.now()
    )
      fail(409, 'ข้อมูลหมดอายุหรือแหล่งข้อมูลไม่ตรงกัน กรุณาค้นหาใหม่');
    const [table] = await this.records.adapter.read([sheet]);
    const record = table.records.find((sourceRecord) => sourceRecord.row === row);
    if (!record || fingerprint(table, record) !== snapshot.hash)
      fail(409, 'ข้อมูลหรือการเรียงแถวเปลี่ยนไป กรุณาค้นหาใหม่ก่อนส่งไปรอตรวจสอบ');
    const key = reviewKey(table, record);
    if (table.records.filter((sourceRecord) => reviewKey(table, sourceRecord) === key).length !== 1)
      fail(409, 'มีแถวที่เหมือนกันทุกช่อง จึงยังยืนยันรายการไม่ได้ กรุณาตรวจสอบแถวซ้ำในชีต');
    const result = await this.records.adapter.setReviewSelection(table, record, body.pending);
    const [freshTable] = await this.records.adapter.read([sheet]);
    const fresh = freshTable.records.find((sourceRecord) => sourceRecord.row === row);
    if (!fresh || reviewKey(freshTable, fresh) !== key)
      fail(409, 'ส่งข้อมูลแล้ว แต่แถวต้นฉบับเปลี่ยนไป กรุณาค้นหาใหม่เพื่อตรวจสอบ');
    const statusIndex = freshTable.headers.findIndex(
      (header) => header.trim() === SEARCH_STATUS_HEADER,
    );
    if (
      sheet === this.records.config.sheets[0] &&
      statusIndex >= 0 &&
      fresh.values[statusIndex] !== (body.pending ? PENDING_STATUS : '')
    )
      fail(409, 'ยืนยันสถานะ IQI ไม่ได้ กรุณาค้นหาใหม่');
    const presented = await this.records.serializeRecord(freshTable, fresh);
    return {
      ...presented,
      revision: presented.revision || this.records.createRecordRevision(freshTable, fresh),
      pending: result.pending,
      reviewUrl: result.reviewUrl,
      reviewSheet: result.reviewSheet,
    };
  }
}
