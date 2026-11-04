import test from 'node:test';
import assert from 'node:assert/strict';
import { ReturnRequestService } from '../../backend/src/features/returns/service.js';
for (const status of ['รอดำเนินการ', 'กำลังดำเนินการ']) {
  test(`return rejects loan status ${status} before writing`, async () => {
    const row = []; row[0] = 'loan'; row[7] = 'asset'; row[8] = ''; row[14] = status;
    const service = new ReturnRequestService({ withWriteLock: (fn) => fn(), validateRequestBody: () => ({}), readLedger: async () => ({ active: [row] }) });
    await assert.rejects(() => service.submit({ date: '2026-11-05', ownLoanIds: ['loan'], selectedAsset: { asset: 'asset', serial: '' } }), { status: 409, message: 'คืนได้เฉพาะรายการที่อยู่ในสถานะกำลังยืม' });
  });
}
