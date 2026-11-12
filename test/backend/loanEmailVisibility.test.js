import test from 'node:test';
import assert from 'node:assert/strict';
import { LendingLedger } from '../../backend/src/core/lending/ledger.js';
import { LOAN_HEADERS, RETURN_HEADERS } from '../../backend/src/core/lending/schema.js';

test('loan email lookup uses named columns, trims case, and fails closed for duplicate item IDs', async () => {
  const headers = ['email', ...LOAN_HEADERS];
  const row = (id, item, email) =>
    headers.map(
      (header) => ({ email, เลขรายการยืม: id, รหัสรายการอุปกรณ์ยืม: item })[header] || '',
    );
  const loans = [
    headers,
    row('L1', 'item1', ' User@Example.Invalid '),
    row('L2', 'duplicate', 'user@example.invalid'),
    row('L3', 'duplicate', 'other@example.invalid'),
  ];
  const ledger = new LendingLedger({
    readLoanSheets: async () => ({ loans, returns: [RETURN_HEADERS] }),
  });
  const data = await ledger.readLedger();
  assert.equal(data.loanEmails.get('item1'), 'user@example.invalid');
  assert.equal(data.loanEmails.get('duplicate'), '');
  assert.equal(data.loans[0][0], 'L1');
  assert.equal(data.loans[0][1], 'item1');
});
