import { assetIdentityKey } from '../../../../shared/features/catalog/search.js';
import {
  LENDING_REQUEST_TYPE,
  LENDING_STATUS,
  MAX_LOAN_DAYS,
} from '../../../../shared/features/lending/status.js';
import { randomUUID } from 'node:crypto';
import {
  formatBangkokTimestamp as currentBangkokTimestamp,
  calendarDaysBetween,
} from '../../../../shared/core/extensions/dates.js';
import { throwHttpError } from '../../core/errors/errors.js';
import {
  validateRequiredText as validateText,
  validateIsoDate,
} from '../../core/validation/values.js';
import { fingerprintJson as fingerprintRequest } from '../../core/security/fingerprint.js';
import { LOAN_TYPES } from '../../../../shared/features/lending/formConstants.js';
export class LoanRequestService {
  constructor(ledger) {
    this.ledger = ledger;
  }
  submit(body) {
    return this.ledger.withWriteLock(async () => {
      const requestData = {
        ...this.ledger.validateRequestBody(body, LOAN_TYPES),
        purpose: validateText(body.purpose, 500),
        start: validateIsoDate(body.start),
        due: validateIsoDate(body.due),
      };
      if (
        requestData.due < requestData.start ||
        calendarDaysBetween(requestData.start, requestData.due) > MAX_LOAN_DAYS
      )
        throwHttpError(400, 'กำหนดคืนต้องไม่ก่อนวันที่ยืมและไม่เกิน 7 วัน');
      await this.ledger.resolveCatalogSelection(body, requestData);
      const hash = fingerprintRequest(requestData),
        ledgerState = await this.ledger.readLedger(),
        existing = ledgerState.loans.filter(
          (sourceRecord) => sourceRecord[17] === requestData.requestId,
        );
      if (existing.length) {
        if (existing.some((sourceRecord) => sourceRecord[18] !== hash))
          throwHttpError(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
        return { id: existing[0][0], unchanged: true };
      }
      if (
        requestData.selected &&
        !(await this.ledger.readAvailableAssets()).records.some(
          (sourceRecord) =>
            assetIdentityKey(sourceRecord) === assetIdentityKey(requestData.selected),
        )
      )
        throwHttpError(409, 'อุปกรณ์นี้ไม่พร้อมยืม กรุณาค้นหาใหม่');
      if (
        requestData.identifier !== '-' &&
        ledgerState.active.some(
          (sourceRecord) =>
            sourceRecord[7] === requestData.identifier ||
            sourceRecord[8] === requestData.identifier,
        )
      )
        throwHttpError(409, 'อุปกรณ์นี้มีรายการยืมค้างอยู่');
      const id = 'L-' + randomUUID();
      await this.ledger.adapter.appendLoanRows('loans', [
        [
          id,
          randomUUID(),
          currentBangkokTimestamp(),
          requestData.borrower,
          requestData.team,
          LENDING_REQUEST_TYPE.LOAN,
          requestData.category,
          requestData.identifier,
          requestData.selected?.serial || '',
          requestData.selected?.name || '',
          requestData.purpose,
          requestData.start,
          requestData.due,
          requestData.notes,
          LENDING_STATUS.LOAN_PENDING,
          '',
          '',
          requestData.requestId,
          hash,
        ],
      ]);
      if (
        !(await this.ledger.readLedger()).loans.some(
          (sourceRecord) => sourceRecord[17] === requestData.requestId && sourceRecord[18] === hash,
        )
      )
        throwHttpError(502, 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม');
      return { id };
    });
  }
}
