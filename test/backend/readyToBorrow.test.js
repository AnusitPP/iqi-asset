import test from 'node:test';
import assert from 'node:assert/strict';
import { readyToBorrowData } from '../../backend/src/services/readyToBorrow.js';

test('ready-to-borrow reads named columns and skips blank asset rows', () => {
  assert.deepEqual(
    readyToBorrowData([
      ['ชื่ออุปกรณ์', 'S/N', 'เลขครุภัณฑ์'],
      ['จอ', 'SN1', 'A1'],
      ['ไม่มีเลข', '', ''],
      ['คอม', '', 'A2'],
    ]),
    {
      records: [
        { row: 2, asset: 'A1', serial: 'SN1', name: 'จอ' },
        { row: 4, asset: 'A2', serial: '', name: 'คอม' },
      ],
    },
  );
});

test('invalid ready-to-borrow headers fail instead of using another source', () => {
  assert.throws(() => readyToBorrowData([]), { status: 422 });
  assert.throws(() => readyToBorrowData([['เลขครุภัณฑ์', 'S/N', 'ชื่ออุปกรณ์', 'S/N']]), {
    status: 422,
  });
});
