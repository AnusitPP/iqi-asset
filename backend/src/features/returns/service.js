import {
  LENDING_REQUEST_TYPE,
  LENDING_STATUS,
} from '../../../../shared/features/lending/status.js';
import { randomUUID } from 'node:crypto';
import { formatBangkokTimestamp as currentBangkokTimestamp } from '../../../../shared/core/extensions/dates.js';
import { throwHttpError } from '../../core/errors/errors.js';
import { validateIsoDate } from '../../core/validation/values.js';
import { fingerprintJson as fingerprintRequest } from '../../core/security/fingerprint.js';
import { RETURN_TYPES } from '../../../../shared/features/lending/formConstants.js';
export class ReturnRequestService {
  constructor(ledger) {
    this.ledger = ledger;
  }
  submit(body) {
    return this.ledger.withWriteLock(async () => {
      const requestData = {
        ...this.ledger.validateRequestBody(body, RETURN_TYPES),
        date: validateIsoDate(body.date),
      };
      let loan;
      if (body.ownLoanIds) {
        const state = await this.ledger.readLedger();
        const matches = state.active.filter(
          (row) =>
            body.ownLoanIds.includes(row[0]) &&
            row[7] === body.selectedAsset?.asset &&
            (row[8] || '') === body.selectedAsset?.serial,
        );
        if (matches.length !== 1)
          throwHttpError(409, 'ไม่พบรายการยืมของบัญชีนี้ที่ตรงกับอุปกรณ์ กรุณาโหลดรายการใหม่');
        loan = matches[0];
        requestData.team = loan[4];
        requestData.identifier = loan[7];
        requestData.category = loan[6];
        requestData.selected = { asset: loan[7], serial: loan[8] || '', name: loan[9] || '' };
      } else await this.ledger.resolveCatalogSelection(body, requestData);
      const hash = fingerprintRequest(requestData),
        ledgerState = await this.ledger.readLedger(),
        existing = ledgerState.returns.filter(
          (sourceRecord) => sourceRecord[17] === requestData.requestId,
        );
      if (existing.length) {
        if (existing.some((sourceRecord) => sourceRecord[18] !== hash))
          throwHttpError(409, 'รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว');
        return { id: existing[0][0], unchanged: true };
      }
      if (loan) {
        if (ledgerState.returns.some((row) => row[2] === loan[1]))
          throwHttpError(409, 'รายการนี้ส่งคำขอคืนแล้ว ไม่สามารถคืนซ้ำได้');
        if (loan[14] !== 'กำลังยืม') throwHttpError(409, 'คืนได้เฉพาะรายการที่อยู่ในสถานะกำลังยืม');
      }
      const id = 'R-' + randomUUID();
      await this.ledger.adapter.appendLoanRows('returns', [
        [
          id,
          loan?.[0] || '',
          loan?.[1] || '',
          currentBangkokTimestamp(),
          requestData.borrower,
          requestData.team,
          LENDING_REQUEST_TYPE.RETURN,
          requestData.category,
          requestData.identifier,
          requestData.selected?.serial || '',
          requestData.selected?.name || '',
          requestData.date,
          requestData.notes,
          '',
          LENDING_STATUS.RETURN_PENDING,
          '',
          '',
          requestData.requestId,
          hash,
        ],
      ]);
      if (
        !(await this.ledger.readLedger()).returns.some(
          (sourceRecord) => sourceRecord[17] === requestData.requestId && sourceRecord[18] === hash,
        )
      )
        throwHttpError(502, 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม');
      return { id };
    });
  }
}
