import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildLoanConfirmation } from '../src/features/mail/loan-confirmation.js';
import { buildDailySummary } from '../src/features/mail/daily-summary.js';
import { buildDueReminders } from '../src/features/mail/due-reminders.js';
import { LENDING_STATUS } from '../../shared/features/lending/status.js';

// Fixture-only preview: no .env, SMTP connection or Google API access.
const env = { FRONTEND_URL: 'https://iqi.example.invalid' };
const row = Array(19).fill('');
Object.assign(row, {
  0: 'L-DEMO-001',
  1: 'ITEM-DEMO-001',
  3: 'ตัวอย่าง ผู้ใช้งาน',
  4: 'IQI',
  7: 'STeP64-107-001',
  8: 'DEMO-SN-001',
  9: 'จอมอนิเตอร์ SAMSUNG 24 นิ้ว',
  10: 'ใช้สำหรับการประชุมและนำเสนองาน',
  11: '2026-11-05',
  12: '2026-11-06',
  14: LENDING_STATUS.LOAN_PENDING,
});
const now = new Date('2026-11-05T01:00:00Z');
const state = { loans: [row], returns: [], active: [row] };
const previews = [
  ['confirmation', 'ยืนยันคำขอยืม', buildLoanConfirmation(row, env)],
  [
    'reminder',
    'แจ้งเตือนก่อนครบกำหนด',
    buildDueReminders(state, new Map([[row[0], 'demo@example.invalid']]), now, env).messages[0],
  ],
  ['summary', 'สรุปยืม–คืน', buildDailySummary(state, now, 'summary', env)],
];
const folder = new URL('../../docs/mail-previews/', import.meta.url);
await mkdir(folder, { recursive: true });
for (const [name, , message] of previews) {
  await writeFile(new URL(`${name}.html`, folder), message.html);
  await writeFile(new URL(`${name}.txt`, folder), message.text);
}
await writeFile(
  new URL('index.html', folder),
  `<!doctype html><html lang="th"><meta charset="utf-8"><title>IQI Asset · Mail previews</title><body style="font:16px Tahoma,sans-serif;max-width:680px;margin:48px auto;padding:20px;background:#fffbeb;color:#422a08;"><h1>ตัวอย่างอีเมล IQI Asset</h1><p>ข้อมูลจำลองสำหรับตรวจหน้าตา ไม่มีการส่งอีเมลจริง</p><ul>${previews.map(([name, label]) => `<li style="margin:16px 0;"><a href="${name}.html">${label}</a> · <a href="${name}.txt">ข้อความสำรอง</a></li>`).join('')}</ul></body></html>`,
);
process.stdout.write(`Mail previews: ${fileURLToPath(new URL('index.html', folder))}\n`);
