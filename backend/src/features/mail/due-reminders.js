import { inspectionAge } from '../../../../shared/core/extensions/dates.js';
import { LENDING_STATUS } from '../../../../shared/features/lending/status.js';
import { renderMailTemplate, loanMailItem } from './templates.js';

const emailPattern = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
const sourceError = (message) => Object.assign(new Error(message), { code: 'EMAIL_SOURCE' });

// Map by stable loan ID, never by row position or a person's display name.
export function parseLoanEmails(values, { idHeader = 'เลขรายการยืม', emailHeader = 'email' } = {}) {
  const headers = (values[0] || []).map((value) => String(value).trim());
  const index = (name) => {
    if (headers.filter((value) => value === name).length !== 1)
      throw sourceError('กรุณาตรวจคอลัมน์รหัสรายการยืมและอีเมลในชีตผู้รับ');
    return headers.indexOf(name);
  };
  const idIndex = index(idHeader),
    emailIndex = index(emailHeader);
  if (idIndex === emailIndex) throw sourceError('คอลัมน์รหัสรายการยืมและอีเมลต้องแยกกัน');
  const emails = new Map();
  for (const row of values.slice(1)) {
    const id = String(row[idIndex] || '').trim();
    const email = String(row[emailIndex] || '').trim();
    if (!id) {
      if (email) throw sourceError('พบอีเมลที่ไม่มีรหัสรายการยืมในชีตผู้รับ');
      continue;
    }
    if (emails.has(id)) throw sourceError('พบรหัสรายการยืมซ้ำในชีตผู้รับ');
    emails.set(id, email);
  }
  return emails;
}

export async function readLoanEmails(adapter, env = process.env) {
  const sheet = env.MAIL_REMINDER_SHEET || 'รายการยืมครุภัณฑ์';
  const { data } = await adapter.api.spreadsheets.values.get({
    spreadsheetId: env.MAIL_REMINDER_SPREADSHEET_ID || adapter.config.spreadsheetId,
    range: `'${sheet.replaceAll("'", "''")}'`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return parseLoanEmails(data.values || [], {
    idHeader: env.MAIL_REMINDER_ID_HEADER || 'เลขรายการยืม',
    emailHeader: env.MAIL_REMINDER_EMAIL_HEADER || 'email',
  });
}

export function buildDueReminders({ active }, emails, now = new Date(), env = process.env) {
  const groups = new Map();
  const ids = new Set();
  let missingEmails = 0,
    invalidDates = 0;
  for (const row of active) {
    if (row[14] === LENDING_STATUS.RETURNED) continue;
    const age = inspectionAge(row[12], now);
    if (!age) {
      invalidDates++;
      continue;
    }
    if (age.days !== -1) continue;
    const email = emails.get(String(row[0]).trim());
    if (!email) {
      missingEmails++;
      continue;
    }
    if (email.length > 254 || !emailPattern.test(email))
      throw sourceError('อีเมลของรายการที่ใกล้ครบกำหนดไม่ถูกต้อง กรุณาตรวจชีตผู้รับ');
    if (ids.has(row[0])) throw sourceError('พบรหัสรายการยืมซ้ำ ไม่สามารถระบุผู้รับได้แน่นอน');
    ids.add(row[0]);
    const key = email.toLowerCase();
    if (!groups.has(key)) groups.set(key, { email, rows: [] });
    groups.get(key).rows.push({ row, date: age.date });
  }
  return {
    missingEmails,
    invalidDates,
    messages: [...groups.values()].map(({ email, rows }) => ({
      email,
      subject: '[IQI Asset] แจ้งเตือนคืนครุภัณฑ์ล่วงหน้า 1 วัน',
      html: renderMailTemplate({
        title: 'ครุภัณฑ์ของคุณครบกำหนดคืนพรุ่งนี้',
        label: 'แจ้งเตือนล่วงหน้า 1 วัน',
        intro: `มี ${rows.length} รายการที่จะครบกำหนดคืนในอีก 1 วัน กรุณาตรวจสอบรายละเอียดและเตรียมส่งคืน`,
        sections: [
          {
            title: 'รายการที่ใกล้ครบกำหนด',
            items: rows.map(({ row, date }) => {
              const item = loanMailItem(row);
              item.badge = `กำหนดคืน ${date}`;
              return item;
            }),
          },
        ],
        notice:
          'หากคืนครุภัณฑ์แล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อปรับสถานะในระบบ ขอบคุณที่ช่วยดูแลอุปกรณ์ส่วนกลาง',
        actionPath: '/my-requests',
        actionLabel: 'ตรวจสอบรายการยืม',
        env,
      }),
      text: [
        'รายการต่อไปนี้จะครบกำหนดคืนในอีก 1 วัน',
        ...rows.map(
          ({ row, date }) => `ผู้ยืม: ${row[3]} | ${row[7]} | ${row[9] || '-'} | กำหนดคืน ${date}`,
        ),
        'กรุณาดำเนินการคืนครุภัณฑ์ตามกำหนด หากคืนแล้วโปรดติดต่อเจ้าหน้าที่เพื่อปรับสถานะ',
      ].join('\n\n'),
    })),
  };
}

export async function deliverDueReminders(plan, factory, report = () => {}) {
  let sent = 0,
    failed = 0;
  for (const { email, subject, text, html } of plan.messages) {
    try {
      // Only one recipient per message; never fall back to a global recipient.
      await factory(email).send({ subject, text, ...(html ? { html } : {}) });
      sent++;
    } catch (error) {
      failed++;
      report(error);
    }
  }
  return { sent, failed };
}
