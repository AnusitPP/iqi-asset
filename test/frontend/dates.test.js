import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectionNote,
  todayBangkok,
  inspectionAge,
} from '../../frontend/public/js/utils/dates.js';
test('today shortcut preserves other note text and only replaces inspection date', () => {
  assert.equal(
    inspectionNote('ซ่อมเมื่อ 1/1/2568\nวันที่ตรวจสอบ 14/5/2569; ใช้งานได้', '20/10/2569'),
    'ซ่อมเมื่อ 1/1/2568\nวันที่ตรวจสอบ 20/10/2569; ใช้งานได้',
  );
  assert.equal(
    inspectionNote('ยังใช้งานได้', '20/10/2569'),
    'ยังใช้งานได้\nวันที่ตรวจสอบ 20/10/2569',
  );
  assert.equal(todayBangkok(new Date('2026-10-19T18:00:00Z')), '20/10/2569');
});
test('inspection age uses Bangkok calendar dates and accepts Buddhist and Gregorian years', () => {
  const now = new Date('2026-10-19T18:00:00Z');
  assert.deepEqual(inspectionAge('14/5/2569', now), { date: '14/05/2569', days: 159 });
  assert.deepEqual(inspectionAge('2026-10-20', now), { date: '20/10/2569', days: 0 });
  assert.deepEqual(inspectionAge('21/10/2569', now), { date: '21/10/2569', days: -1 });
  assert.equal(inspectionAge('31/2/2569', now), null);
  assert.equal(inspectionAge('', now), null);
});
