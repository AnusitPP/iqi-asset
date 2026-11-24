import { bangkokIsoDate } from '../../../../shared/core/extensions/dates.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { buildDailySummary } from './daily-summary.js';

// Preview fixtures only; never passed to the send route or persisted to Sheets.
export function buildMailMockup(groups, now = new Date(), env = process.env) {
  const date = (offset) => {
    const day = new Date(`${bangkokIsoDate(now)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  };
  const loan = (id, name, due, status) => {
    const row = Array(19).fill('');
    Object.assign(row, {
      0: `MOCK-${id}`,
      3: 'ผู้ยืมตัวอย่าง',
      4: 'IQI (ข้อมูลจำลอง)',
      7: `DEMO-ASSET-${id}`,
      8: `DEMO-SN-${id}`,
      9: name,
      10: 'ข้อมูลจำลองสำหรับตรวจรูปแบบอีเมล',
      11: date(-7),
      12: date(due),
      14: status,
    });
    return row;
  };
  const loans = [],
    returns = [],
    active = [];
  if (groups.includes('pending'))
    loans.push(loan('APPROVAL', 'โน้ตบุ๊กตัวอย่าง', 7, LENDING_STATUS.LOAN_PENDING));
  if (groups.includes('return')) {
    const original = loan('LOAN-RETURN', 'จอมอนิเตอร์ตัวอย่าง', 2, 'กำลังยืม');
    loans.push(original);
    const row = Array(19).fill('');
    Object.assign(row, {
      0: 'MOCK-RETURN',
      1: original[0],
      4: original[3],
      5: original[4],
      8: original[7],
      9: original[8],
      10: original[9],
      11: date(0),
      14: LENDING_STATUS.RETURN_PENDING,
    });
    returns.push(row);
  }
  if (groups.includes('overdue')) {
    const row = loan('OVERDUE', 'โปรเจกเตอร์ตัวอย่าง', -3, 'กำลังยืม');
    loans.push(row);
    active.push(row);
  }
  const message = buildDailySummary(
    {
      loans,
      returns,
      active,
      nicknames: new Map([['ผู้ยืมตัวอย่าง', 'เดโม']]),
    },
    now,
    'summary',
    env,
  );
  return { ...message, subject: `[ข้อมูลจำลอง] ${message.subject}` };
}
