import { inspectionAge, todayBangkok } from '../../../../shared/core/extensions/dates.js';
import { borrowerNickname } from '../loans/staff-nicknames.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { renderMailTemplate, loanMailItem, mailDate } from './templates.js';

export function buildDailySummary(
  { loans, returns, active, nicknames = new Map() },
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
      reportDate: new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
      intro: `ข้อมูล ณ วันที่ ${date} ตามเวลา Asia/Bangkok`,
      summary: [
        { title: 'รออนุมัติ', count: type !== 'return' ? pending.length : 0, tone: 'warning' },
        { title: 'รอรับคืน', count: type !== 'loan' ? awaitingReturn.length : 0, tone: 'success' },
        { title: 'ยืมเกินกำหนด', count: type !== 'return' ? overdue.length : 0, tone: 'danger' },
      ],
      sections: [
        ...(type !== 'return'
          ? [
              {
                title: `รายการยืมเกินกำหนด · ${overdue.length} รายการ`,
                tone: 'danger',
                items: overdue.map((row) =>
                  loanMailItem(row, { now, nickname: borrowerNickname(nicknames, row[3]) }),
                ),
              },
              {
                title: `คำขอยืมรอดำเนินการ · ${pending.length} รายการ`,
                tone: 'warning',
                items: pending.map((row) =>
                  loanMailItem(row, { now, nickname: borrowerNickname(nicknames, row[3]) }),
                ),
              },
            ]
          : []),
        ...(type !== 'loan'
          ? [
              {
                title: `รายการรอรับคืน · ${awaitingReturn.length} รายการ`,
                tone: 'success',
                items: awaitingReturn.map((row) => {
                  const original = loans.find((entry) => entry[0] === row[1]);
                  const item = original
                    ? loanMailItem(original, {
                        now,
                        nickname: borrowerNickname(nicknames, original[3]),
                      })
                    : {
                        fields: [
                          ['ทีม', row[5]],
                          ['เลขครุภัณฑ์', row[8]],
                          ['Serial Number', row[9]],
                        ],
                      };
                  return {
                    ...item,
                    title: row[10] || row[8],
                    badge: row[14],
                    overdueDays: 0,
                    fields: [
                      ...item.fields,
                      ['เลขคำขอคืน', row[0]],
                      ['ผู้คืน', row[4]],
                      ['วันที่ส่งคืน', mailDate(row[11])],
                    ],
                  };
                }),
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
