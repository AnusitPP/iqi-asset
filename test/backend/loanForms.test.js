import test from 'node:test';
import assert from 'node:assert/strict';
import { Loans, LOAN_HEADERS, RETURN_HEADERS } from '../helpers/lending.js';
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

import { catalogCategory } from '../../shared/features/catalog/search.js';
test('catalog selections use authoritative sheet identity and reject missing records', async () => {
  const grids = { loans: [LOAN_HEADERS], returns: [RETURN_HEADERS] };
  const service = new Loans({
    readLoanSheets: async () => structuredClone(grids),
    readReadyToBorrow: async () => [
      ['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์'],
      ['A1', 'SN1', 'จอมอนิเตอร์ Samsung'],
    ],
    appendLoanRows: async (k, r) => grids[k].push(...r),
  });
  const selected = {
    ...form,
    identifier: 'tampered',
    category: catalogCategory('จอมอนิเตอร์'),
    selectedAsset: { asset: 'A1', serial: 'SN1' },
  };
  await service.borrowForm(selected);
  assert.equal(grids.loans[1][7], 'A1');
  assert.equal(grids.loans[1][8], 'SN1');
  assert.equal(grids.loans[1][9], 'จอมอนิเตอร์ Samsung');
  await assert.rejects(() => service.borrowForm({ ...selected, requestId: 'another-request' }), {
    status: 409,
  });
  await assert.rejects(
    () =>
      service.returnForm({
        ...selected,
        requestId: 'bad-return-001',
        date: '2026-10-29',
        selectedAsset: { asset: 'missing', serial: '' },
      }),
    { status: 409 },
  );
  await service.returnForm({ ...selected, requestId: 'valid-return-001', date: '2026-10-29' });
  assert.equal(grids.returns[1][8], 'A1');
  assert.equal(grids.returns[1][9], 'SN1');
  assert.equal(grids.returns[1][14], 'รอรับคืน');
});

test('form submissions share one ledger lock and reject hosted writes', async () => {
  const { service, grids } = make();
  const request = { ...form, identifier: 'A1' };
  const outcomes = await Promise.allSettled([
    service.borrowForm(request),
    service.borrowForm({ ...request, requestId: 'concurrent-form-02' }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.status, 409);
  assert.equal(grids.loans.length, 2);
  assert.throws(() => new Loans({}, { hosted: true }).borrowForm(form), { status: 503 });
  await assert.rejects(() => service.borrowForm({ ...request, purpose: 'changed' }), {
    status: 409,
  });
});
