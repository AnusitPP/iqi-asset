import { hasPermission } from '../../../../shared/features/auth/permissions.js';
import { mailSettings, createMailer } from './mailer.js';
import { buildDailySummary } from './daily-summary.js';
import { buildMailMockup } from './mockup.js';
import { mailErrorMessage, mailErrorDiagnostic } from './errors.js';

export function registerMailRoutes(
  app,
  {
    lendingLedger,
    env = process.env,
    factory = createMailer,
    readStaffNicknames = async () => new Map(),
  },
) {
  app.post('/api/mail/mockup', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (!hasPermission(req.user, 'ADMIN_DASHBOARD_VIEW'))
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดูตัวอย่างอีเมล' });
    const { groups } = req.body || {};
    if (
      !Array.isArray(groups) ||
      groups.length > 3 ||
      groups.some((group) => !['pending', 'return', 'overdue'].includes(group)) ||
      new Set(groups).size !== groups.length
    )
      return res.status(400).json({ error: 'กรุณาเลือกกลุ่มข้อมูลจำลองให้ถูกต้อง' });
    res.set('Cache-Control', 'no-store');
    res.json(buildMailMockup(groups, new Date(), env));
  });
  app.post('/api/mail/preview', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    if (!hasPermission(req.user, 'ADMIN_DASHBOARD_VIEW'))
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดูตัวอย่างอีเมล' });
    const { type } = req.body || {};
    if (!['summary', 'loan', 'return'].includes(type))
      return res.status(400).json({ error: 'กรุณาเลือกประเภทอีเมลให้ถูกต้อง' });
    res.set('Cache-Control', 'no-store');
    try {
      res.json(
        buildDailySummary(
          { ...(await lendingLedger.readLedger()), nicknames: await readStaffNicknames() },
          new Date(),
          type,
          env,
        ),
      );
    } catch {
      res.status(502).json({ error: 'อ่านข้อมูลชีตยืม–คืนเพื่อแสดงตัวอย่างไม่สำเร็จ' });
    }
  });
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
      const message = buildDailySummary(
        { ...(await lendingLedger.readLedger()), nicknames: await readStaffNicknames() },
        new Date(),
        type,
        env,
      );
      stage = 'smtp';
      await factory(settings).send(message);
      res.json({ sent: true });
    } catch (error) {
      const diagnostic = stage === 'smtp' ? mailErrorDiagnostic(error) : {};
      const reason =
        stage === 'sheets'
          ? 'อ่านข้อมูลชีตยืม–คืนไม่สำเร็จ กรุณาตรวจสิทธิ์ ชื่อแท็บ และหัวคอลัมน์ชีต'
          : mailErrorMessage(error);
      const suffix = Object.values(diagnostic).length
        ? ` (${Object.values(diagnostic).join(' / ')})`
        : '';
      process.stderr.write(`Mail send failed (${stage}): ${reason}${suffix}\n`);
      res.status(502).json({
        error: `ส่งอีเมลไม่สำเร็จ: ${reason}${suffix}${stage === 'smtp' ? ' หาก SMTP รับข้อความไปแล้วอาจได้รับเมล กรุณาตรวจสอบก่อนส่งซ้ำ' : ''}`,
        stage,
        ...diagnostic,
      });
    }
  });
}
