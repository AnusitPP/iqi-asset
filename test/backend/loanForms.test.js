import test from 'node:test';
import assert from 'node:assert/strict';
import { Loans, LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/services/loans.js';
const make = () => {
  const grids = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const adapter = {
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์']],
    appendLoanRows: async (k, r) => grids[k].push(...r),
  };
  return { service: new Loans(adapter), grids };
};
const form = {
  requestId: 'form-test-001',
  borrower: 'ทดสอบ',
  team: 'IQI',
  category: 'คีย์บอร์ด (Keyboard)',
  identifier: '-',
  purpose: 'ประชุม',
  start: '2026-10-29',
  due: '2026-10-30',
  notes: '',
};
test('original loan form accepts manual identifier and preserves selected type', async () => {
  const { service, grids } = make();
  await service.borrowForm(form);
  assert.equal(grids.loans[1][7], '-');
  assert.equal(grids.loans[1][6], form.category);
  assert.equal(grids.loans[1][14], 'รอดำเนินการ');
  await service.borrowForm(form);
  assert.equal(grids.loans.length, 2);
  await assert.rejects(() => service.borrowForm({ ...form, team: 'fake' }), { status: 400 });
  await assert.rejects(() => service.borrowForm({ ...form, due: '2026-11-20' }), { status: 400 });
});
test('original return form accepts external asset without staff/condition and awaits inspection', async () => {
  const { service, grids } = make();
  const b = {
    requestId: 'return-form-001',
    borrower: 'ผู้คืน',
    team: 'IQI',
    category: 'อื่นๆ',
    identifier: '111111111',
    date: '2026-10-29',
    notes: 'ชำรุด',
  };
  await service.returnForm(b);
  assert.equal(grids.returns[1][8], b.identifier);
  assert.equal(grids.returns[1][14], 'รอรับคืน');
  assert.equal(grids.returns[1][13], '');
  await service.returnForm(b);
  assert.equal(grids.returns.length, 2);
});
