import { inspectionAge, todayBangkok } from '../../../../shared/core/extensions/dates.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';

export function buildDailySummary({ loans, returns, active }, now = new Date(), type = 'summary') {
  const pending = loans.filter((row) => row[14] === LENDING_STATUS.LOAN_PENDING);
  const awaitingReturn = returns.filter((row) => row[14] === LENDING_STATUS.RETURN_PENDING);
  const overdue = active.filter(
    (row) => row[14] !== LENDING_STATUS.RETURNED && inspectionAge(row[12], now)?.days > 0,
  );
  const loanLine = (row) =>
    `- ${row[0]} | ${row[3]} | ${row[7]} | ${row[9] || '-'} | กำหนดคืน ${row[12] || '-'}`;
  const section = (title, rows, line) =>
    `${title}: ${rows.length} รายการ\n${rows.length ? rows.map(line).join('\n') : '- ไม่มีรายการ'}`;
  const date = todayBangkok(now);
  return {
    subject: `[IQI Asset] ${type === 'loan' ? 'สรุปรายการยืม' : type === 'return' ? 'สรุปรายการคืน' : 'สรุปยืม–คืนประจำวัน'} ${date}`,
    text: [
      `สรุปข้อมูล IQI Asset วันที่ ${date} (Asia/Bangkok)`,
      ...(type !== 'return' ? [section('คำขอยืมรอดำเนินการ', pending, loanLine)] : []),
      ...(type !== 'loan'
        ? [
            section(
              'รายการรอรับคืน',
              awaitingReturn,
              (row) => `- ${row[0]} | ${row[4]} | ${row[8]} | ${row[10] || '-'}`,
            ),
          ]
        : []),
      ...(type !== 'return'
        ? [
            section('รายการยืมเกินกำหนดที่ยังไม่รับคืน', overdue, loanLine),
            'หมายเหตุ: รายการรอดำเนินการอาจอยู่ในกลุ่มเกินกำหนดด้วย กรุณาตรวจสอบสถานะในระบบ',
          ]
        : []),
    ].join('\n\n'),
  };
}
