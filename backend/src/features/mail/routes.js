import { hasPermission } from '../../../../shared/features/auth/permissions.js';
import { mailSettings, createMailer } from './mailer.js';
import { buildDailySummary } from './daily-summary.js';
import { mailErrorMessage } from './errors.js';

export function registerMailRoutes(
  app,
  { lendingLedger, env = process.env, factory = createMailer },
) {
  app.post('/api/mail/send', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (!hasPermission(req.user, 'ADMIN_DASHBOARD_VIEW'))
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ส่งอีเมล' });
    const { email, type } = req.body || {};
    if (
      typeof email !== 'string' ||
      email.length > 254 ||
      !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email.trim()) ||
      !['summary', 'loan', 'return'].includes(type)
    )
      return res
        .status(400)
        .json({ error: 'กรุณากรอกอีเมลผู้รับหนึ่งรายการและเลือกประเภทให้ถูกต้อง' });
    let stage = 'settings';
    try {
      const settings = mailSettings(env, email.trim());
      stage = 'sheets';
      const message = buildDailySummary(await lendingLedger.readLedger(), new Date(), type);
      stage = 'smtp';
      await factory(settings).send(message);
      res.json({ sent: true });
    } catch (error) {
      const reason =
        stage === 'sheets'
          ? 'อ่านข้อมูลชีตยืม–คืนไม่สำเร็จ กรุณาตรวจสิทธิ์ ชื่อแท็บ และหัวคอลัมน์ชีต'
          : mailErrorMessage(error);
      res.status(502).json({
        error: `ส่งอีเมลไม่สำเร็จ: ${reason}${stage === 'smtp' ? ' หาก SMTP รับข้อความไปแล้วอาจได้รับเมล กรุณาตรวจสอบก่อนส่งซ้ำ' : ''}`,
        stage,
      });
    }
  });
}
