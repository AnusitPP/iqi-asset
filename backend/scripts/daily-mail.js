import 'dotenv/config';
import { GoogleSheets } from '../src/integrations/google/googleSheets.js';
import { createMailer, smtpSettings } from '../src/features/mail/mailer.js';
import { mailErrorMessage } from '../src/features/mail/errors.js';
import { loadReminderPlan, runDueReminders } from '../src/features/mail/reminder-job.js';

const [mode, ...extra] = process.argv.slice(2);
const validMode = !extra.length && ['--preview', '--verify', '--send'].includes(mode);
try {
  if (!validMode) throw new Error('Invalid command');
  if (mode === '--verify') {
    await createMailer(smtpSettings()).verify();
    process.stdout.write('SMTP connection verified (no email sent)\n');
  } else {
    const { config } = await import('../src/core/config/config.js');
    const adapter = new GoogleSheets(config);
    if (mode === '--preview') {
      const plan = await loadReminderPlan(adapter);
      process.stdout.write(
        `Recipients: ${plan.messages.length}; due loans without email: ${plan.missingEmails}; active loans with invalid dates: ${plan.invalidDates}\n`,
      );
      for (const message of plan.messages)
        process.stdout.write(`To: ${message.email}\n${message.subject}\n\n${message.text}\n\n`);
    } else {
      const result = await runDueReminders(adapter);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.failed) process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(
    `Mail job failed: ${validMode ? mailErrorMessage(error) : 'Use --preview, --verify or --send'}\n`,
  );
  process.exitCode = 1;
}
