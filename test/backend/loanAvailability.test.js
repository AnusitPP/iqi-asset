import test from 'node:test';
import assert from 'node:assert/strict';
import { LendingLedger } from '../../backend/src/core/lending/ledger.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';

for (const status of ['ไม่อนุมัติ', 'ยกเลิก', 'รอดำเนินการ', 'กำลังยืม']) {
  test(`availability after loan status ${status} preserves history`, async () => {
    const row = Array(LOAN_HEADERS.length).fill('');
    row[0] = 'loan';
    row[1] = 'item';
    row[7] = 'asset';
    row[8] = 'serial';
    row[14] = status;
    const ledger = new LendingLedger({
      readLoanSheets: async () => ({ loans: [LOAN_HEADERS, row], returns: [RETURN_HEADERS] }),
      readReadyToBorrow: async () => [
        ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
        ['asset', 'serial', 'อุปกรณ์'],
      ],
    });
    const released = ['ไม่อนุมัติ', 'ยกเลิก'].includes(status);
    assert.equal((await ledger.readAvailableAssets()).records.length, released ? 1 : 0);
    const state = await ledger.readLedger();
    assert.equal(state.loans.length, 1);
    assert.equal(state.active.length, released ? 0 : 1);
  });
}
