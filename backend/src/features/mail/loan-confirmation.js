import { createMailer, mailSettings } from './mailer.js';
import { mailErrorMessage } from './errors.js';
import { renderMailTemplate, loanMailItem } from './templates.js';

export function buildLoanConfirmation(row, env = process.env) {
  const item = loanMailItem(row);
  item.fields.push(['เหตุผลหรือวัตถุประสงค์', row[10]]);
  return {
    subject: `[IQI Asset] รับคำขอยืม ${row[9]} แล้ว`,
    text: [
      `บันทึกคำขอยืมเลขที่ ${row[0]} แล้ว กรุณารอเจ้าหน้าที่ดำเนินการ`,
      `ชื่ออุปกรณ์: ${row[9] || '-'}`,
      ...item.fields.map(([label, value]) => `${label}: ${value || '-'}`),
      `สถานะคำขอ: ${row[14]}`,
      'ตรวจสอบคำขอได้ที่เมนูรายการของฉันในระบบ IQI Asset',
    ].join('\n\n'),
    html: renderMailTemplate({
      title: 'รับคำขอยืมเรียบร้อยแล้ว',
      label: 'ยืนยันรับคำขอ',
      intro: `สวัสดีคุณ ${row[3]} ระบบบันทึกคำขอแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบและดำเนินการ`,
      sections: [{ title: 'รายละเอียดคำขอยืม', items: [item] }],
      notice: 'ติดตามสถานะล่าสุดได้ที่เมนูรายการของฉัน หากต้องการแก้ไขคำขอ กรุณาติดต่อเจ้าหน้าที่',
      actionPath: '/my-requests',
      actionLabel: 'ดูรายการของฉัน',
      env,
    }),
  };
}

export async function sendLoanConfirmation(
  ledger,
  result,
  email,
  { env = process.env, factory = createMailer } = {},
) {
  if (result.unchanged) return;
  try {
    const settings = mailSettings(env, email);
    const rows = (await ledger.readLedger()).loans.filter((row) => row[0] === result.id);
    if (rows.length !== 1) throw new Error('Cannot identify saved loan');
    await factory(settings).send(buildLoanConfirmation(rows[0], env));
    return 'sent';
  } catch (error) {
    // The loan is already saved; SMTP failure must not trigger another submission.
    process.stderr.write(`Loan confirmation failed: ${mailErrorMessage(error)}\n`);
    return 'failed';
  }
}
