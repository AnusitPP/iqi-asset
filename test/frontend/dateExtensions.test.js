import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayBangkok,
  formatBangkokTimestamp,
  formatBangkokInspectionTimestamp,
  formatBangkokDisplayTimestamp,
  toBangkokSheetSerial,
  isIsoCalendarDate,
  calendarDaysBetween,
} from '../../shared/core/extensions/dates.js';
test('central date extensions preserve Bangkok boundary and legacy formatting', () => {
  const instant = new Date('2026-10-28T17:00:00Z');
  assert.equal(todayBangkok(instant), '29/10/2569');
  assert.equal(
    formatBangkokTimestamp(instant),
    new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(instant),
  );
  assert.equal(formatBangkokInspectionTimestamp(instant), '29/10/2569 00:00:00');
  assert.equal(
    formatBangkokDisplayTimestamp(instant),
    instant.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
  );
  assert.equal(
    toBangkokSheetSerial(instant),
    Date.parse('2026-10-29T00:00:00Z') / 86400000 + 25569,
  );
  assert.equal(isIsoCalendarDate('2026-02-30'), false);
  assert.equal(isIsoCalendarDate('2028-02-29'), true);
  assert.equal(calendarDaysBetween('2026-10-29', '2026-11-05'), 7);
});
