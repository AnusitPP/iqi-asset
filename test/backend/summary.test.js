import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSummary } from '../../backend/src/features/records/summary.js';
test('summary keeps all four identity fields and extracts only inspection dates', () => {
  const headers = ['ชื่อ - นามสกุล', 'ชื่อย่อ', 'ชื่อเล่น', 'ทีม', 'หมายเหตุ', 'วันที่ซื้อ'];
  const values = [
    'Full Name',
    'FN',
    'Nick',
    '15.IQI',
    'ซ่อม 1/1/2568\nวันที่ตรวจสอบ 14/5/2569',
    '1/2/2569',
  ];
  const summary = recordSummary(headers, values);
  assert.deepEqual(summary, {
    owner: 'Full Name',
    initials: 'FN',
    nickname: 'Nick',
    team: '15.IQI',
    inspectionDate: '14/5/2569',
  });
  assert.equal(
    recordSummary(headers, ['', '', '', '', 'ซ่อม 1/1/2568', '20/10/2569']).inspectionDate,
    '',
  );
});
test('uses dedicated inspection date header and retains blanks for absent identity columns', () => {
  assert.deepEqual(recordSummary(['วันที่ตรวจสอบ', 'ชื่อเล่น'], ['20/10/2569', 'Nick']), {
    owner: '',
    initials: '',
    nickname: 'Nick',
    team: '',
    inspectionDate: '20/10/2569',
  });
});
