import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewValues, reviewKey, REVIEW_HEADERS, reviewTimestamp } from '../src/reviewQueue.js';
import { parseSheet } from '../src/searchService.js';
test('edit timestamp uses Bangkok wall time independently of host timezone', () => {
  assert.equal(
    reviewTimestamp(new Date('2026-10-19T17:00:00Z')),
    Date.UTC(2026, 9, 20) / 86400000 + 25569,
  );
});
test('maps the nine requested fields from source header aliases without merging sources', () => {
  const t = parseSheet('all', [
    [
      'อุปกรณ์',
      'ชื่อ - นามสกุล',
      'ชื่อเล่น',
      'ชื่อย่อ',
      'ทีม',
      'Brand',
      'S/N',
      'เลขครุภัณฑ์',
      'รายละเอียด',
    ],
    ['Mouse', 'Full Name', 'Nick', 'FN', '15.IQI', 'Logitech', 'SN-001', '207-007', 'Details'],
  ]);
  assert.deepEqual(reviewValues(t, t.records[0]), [
    'Mouse',
    'Full Name',
    'Nick',
    'FN',
    'IQI',
    'Logitech',
    'SN-001',
    '207-007',
    'Details',
  ]);
  assert.equal(REVIEW_HEADERS.length, 12);
  const same = parseSheet('IQI', [t.headers, t.records[0].values]);
  assert.notEqual(reviewKey(t, t.records[0]), reviewKey(same, same.records[0]));
});
test('queue identity survives sorting and status changes, but does not guess missing fields', () => {
  const t = parseSheet('IQI', [
    ['เลขครุภัณฑ์', 'สถานะการค้นหา'],
    ['001', ''],
  ]);
  const r = t.records[0];
  const key = reviewKey(t, r);
  r.row = 99;
  r.values[1] = 'รอค้นหา';
  assert.equal(reviewKey(t, r), key);
  assert.deepEqual(reviewValues(t, r), ['', '', '', '', '', '', '', '001', '']);
});
