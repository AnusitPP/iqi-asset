import { assetIdentityKey } from '../../../../shared/features/catalog/search.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { throwHttpError } from '../errors/errors.js';
import { validateRequiredText as validateText } from '../validation/values.js';
import { FORM_TEAMS } from '../../../../shared/features/lending/formConstants.js';
import { catalogCategory } from '../../../../shared/features/catalog/search.js';
import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
import { LOAN_HEADERS } from './schema.js';
import { RETURN_HEADERS } from './schema.js';
function parseLedgerRows(values, headers) {
  if (JSON.stringify(values[0]) !== JSON.stringify(headers))
    throwHttpError(422, 'หัวคอลัมน์ชีตยืม–คืนไม่ตรง กรุณาตรวจสอบ');
  return values.slice(1).filter((row) => row[0]);
}
export class LendingLedger {
  constructor(adapter, config = {}) {
    this.adapter = adapter;
    this.config = config;
    this.queue = Promise.resolve();
  }
  async readLedger() {
    const sheetData = await this.adapter.readLoanSheets();
    const loans = parseLedgerRows(sheetData.loans, LOAN_HEADERS),
      returns = parseLedgerRows(sheetData.returns, RETURN_HEADERS);
    const returned = new Set(
      returns
        .filter((sourceRecord) => sourceRecord[14] === LENDING_STATUS.RETURN_RECEIVED)
        .map((sourceRecord) => sourceRecord[2]),
    );
    return {
      loans,
      returns,
      active: loans.filter((sourceRecord) => !returned.has(sourceRecord[1])),
    };
  }
  async readAvailableAssets() {
    const [data, ledgerState] = await Promise.all([
      this.adapter.readReadyToBorrow(),
      this.readLedger(),
    ]);
    const blocked = new Set(
      ledgerState.active.map((sourceRecord) =>
        assetIdentityKey({ asset: sourceRecord[7], serial: sourceRecord[8] || '' }),
      ),
    );
    const latest = new Map();
    for (const sourceRecord of ledgerState.returns.filter(
      (sourceRecord) => sourceRecord[14] === LENDING_STATUS.RETURN_RECEIVED,
    ))
      latest.set(
        assetIdentityKey({ asset: sourceRecord[8], serial: sourceRecord[9] || '' }),
        sourceRecord[13],
      );
    return {
      records: readyToBorrowData(data).records.filter(
        (sourceRecord) =>
          !blocked.has(assetIdentityKey(sourceRecord)) &&
          (!latest.has(assetIdentityKey(sourceRecord)) ||
            latest.get(assetIdentityKey(sourceRecord)) === 'ดี'),
      ),
    };
  }
  async readOutstandingLoans() {
    const ledgerState = await this.readLedger();
    return {
      records: ledgerState.active.map((sourceRecord) => ({
        loanId: sourceRecord[0],
        itemId: sourceRecord[1],
        borrower: sourceRecord[3],
        team: sourceRecord[4],
        category: sourceRecord[6],
        asset: sourceRecord[7],
        serial: sourceRecord[8] || '',
        name: sourceRecord[9],
        start: sourceRecord[11],
        due: sourceRecord[12],
      })),
    };
  }
  withWriteLock(work) {
    if (this.config.hosted)
      throwHttpError(
        503,
        'การบันทึกยืม–คืนต้องใช้เซิร์ฟเวอร์เดียว ขณะนี้เปิดให้บันทึกผ่าน localhost เท่านั้น',
      );
    const job = this.queue.catch(() => {}).then(work);
    this.queue = job.catch(() => {});
    return job;
  }
  validateRequestBody(body, types) {
    const requestData = {
      requestId: validateText(body.requestId, 100),
      borrower: validateText(body.borrower),
      team: validateText(body.team),
      category: validateText(body.category),
      identifier: validateText(body.identifier, 500),
      notes: validateText(body.notes ?? '', 2000, false),
    };
    if (
      !/^[\w-]{8,100}$/.test(requestData.requestId) ||
      !FORM_TEAMS.includes(requestData.team) ||
      !types.includes(requestData.category)
    )
      throwHttpError(400, 'กรุณาเลือกทีมและประเภทจากรายการ');
    return requestData;
  }
  async resolveCatalogSelection(body, requestData) {
    if (!body.selectedAsset) return;
    const records = readyToBorrowData(await this.adapter.readReadyToBorrow()).records;
    const matches = records.filter(
      (sourceRecord) =>
        sourceRecord.asset === body.selectedAsset.asset &&
        sourceRecord.serial === body.selectedAsset.serial,
    );
    if (matches.length !== 1)
      throwHttpError(409, 'ไม่พบอุปกรณ์ในชีตพร้อมยืมหรือข้อมูลซ้ำ กรุณาค้นหาใหม่');
    const record = matches[0];
    requestData.identifier = record.asset;
    requestData.category = catalogCategory(record.name);
    requestData.selected = { asset: record.asset, serial: record.serial, name: record.name };
  }
}
