import { createHash, timingSafeEqual } from 'node:crypto';
import { runDueReminders } from './reminder-job.js';
import { mailErrorMessage } from './errors.js';

const digest = (value) => createHash('sha256').update(value).digest();

export function registerMailCron(app, { adapter, env = process.env, run = runDueReminders }) {
  let running = false;
  app.get('/api/cron/due-reminders', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const secret = env.CRON_SECRET;
    if (!secret?.trim()) return res.status(503).json({ error: 'กรุณาตั้งค่า CRON_SECRET' });
    const authorization = req.get('authorization') || '';
    if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`)))
      return res.status(401).json({ error: 'ไม่อนุญาตให้เรียก cron' });
    if (running) return res.status(409).json({ error: 'งานแจ้งเตือนกำลังทำงาน' });
    running = true;
    try {
      const result = await run(adapter, { env });
      process.stdout.write(`Due reminder cron: ${JSON.stringify(result)}\n`);
      res.status(result.failed ? 502 : 200).json(result);
    } catch (error) {
      const reason = mailErrorMessage(error);
      process.stderr.write(`Due reminder cron failed: ${reason}\n`);
      res.status(502).json({ error: reason });
    } finally {
      running = false;
    }
  });
}
