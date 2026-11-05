import { inspectionAge, todayBangkok } from '../../../../shared/core/extensions/dates.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { renderMailTemplate, loanMailItem } from './templates.js';

export function buildDailySummary(
  { loans, returns, active },
  now = new Date(),
  type = 'summary',
  env = process.env,
) {
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
  const title =
    type === 'loan' ? 'สรุปรายการยืม' : type === 'return' ? 'สรุปรายการคืน' : 'สรุปยืม–คืนประจำวัน';
  return {
    subject: `[IQI Asset] ${title} ${date}`,
    html: renderMailTemplate({
      title,
      label: 'รายงานจากระบบ',
      intro: `ข้อมูล ณ วันที่ ${date} ตามเวลา Asia/Bangkok`,
      sections: [
        ...(type !== 'return'
          ? [
              {
                title: `คำขอยืมรอดำเนินการ · ${pending.length} รายการ`,
                items: pending.map(loanMailItem),
              },
            ]
          : []),
        ...(type !== 'loan'
          ? [
              {
                title: `รายการรอรับคืน · ${awaitingReturn.length} รายการ`,
                items: awaitingReturn.map((row) => ({
                  title: row[10] || row[8],
                  badge: row[14],
                  fields: [
                    ['เลขคำขอคืน', row[0]],
                    ['ผู้คืน', row[4]],
                    ['เลขครุภัณฑ์', row[8]],
                    ['S/N', row[9]],
                    ['วันที่ส่งคืน', row[11]],
                  ],
                })),
              },
            ]
          : []),
        ...(type !== 'return'
          ? [
              {
                title: `รายการยืมเกินกำหนด · ${overdue.length} รายการ`,
                items: overdue.map(loanMailItem),
              },
            ]
          : []),
      ],
      notice:
        type !== 'return'
          ? 'รายการรอดำเนินการอาจอยู่ในกลุ่มเกินกำหนดด้วย กรุณาตรวจสอบสถานะล่าสุดในระบบ'
          : undefined,
      actionPath: '/my-requests',
      env,
    }),
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
