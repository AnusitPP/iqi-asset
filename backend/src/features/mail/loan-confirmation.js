import { createMailer, mailSettings } from './mailer.js';
import { mailErrorMessage } from './errors.js';

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
    const row = rows[0];
    await factory(settings).send({
      subject: `[IQI Asset] รับคำขอยืม ${row[9]} แล้ว`,
      text: [
        `บันทึกคำขอยืมเลขที่ ${row[0]} แล้ว กรุณารอเจ้าหน้าที่ดำเนินการ`,
        `ผู้ยืม: ${row[3]}`,
        `ทีม: ${row[4]}`,
        `เลขครุภัณฑ์: ${row[7]}`,
        `S/N: ${row[8] || '-'}`,
        `ชื่ออุปกรณ์: ${row[9] || '-'}`,
        `เหตุผลหรือวัตถุประสงค์: ${row[10]}`,
        `วันที่ต้องการยืม: ${row[11]}`,
        `กำหนดวันส่งคืน: ${row[12]}`,
        `สถานะคำขอ: ${row[14]}`,
        'ตรวจสอบคำขอได้ที่เมนูรายการของฉันในระบบ IQI Asset',
      ].join('\n\n'),
    });
    return 'sent';
  } catch (error) {
    // The loan is already saved; SMTP failure must not trigger another submission.
    process.stderr.write(`Loan confirmation failed: ${mailErrorMessage(error)}\n`);
    return 'failed';
  }
}
