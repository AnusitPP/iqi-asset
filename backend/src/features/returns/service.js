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
      await this.ledger.resolveCatalogSelection(body, requestData);
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
      const id = 'R-' + randomUUID();
      await this.ledger.adapter.appendLoanRows('returns', [
        [
          id,
          '',
          '',
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
