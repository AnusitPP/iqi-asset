import { LendingLedger } from '../../core/lending/ledger.js';
import { readLoanEmails, buildDueReminders, deliverDueReminders } from './due-reminders.js';
import { mailSettings, createMailer } from './mailer.js';
import { mailErrorMessage } from './errors.js';

export async function loadReminderPlan(adapter, { env = process.env, now = new Date() } = {}) {
  const ledger = new LendingLedger(adapter);
  const [state, emails] = await Promise.all([ledger.readLedger(), readLoanEmails(adapter, env)]);
  return buildDueReminders(state, emails, now, env);
}

export async function runDueReminders(
  adapter,
  { env = process.env, now = new Date(), factory = createMailer } = {},
) {
  const plan = await loadReminderPlan(adapter, { env, now });
  const result = await deliverDueReminders(
    plan,
    (email) => factory(mailSettings(env, email)),
    (error) => process.stderr.write(`Reminder failed: ${mailErrorMessage(error)}\n`),
  );
  return {
    recipients: plan.messages.length,
    missingEmails: plan.missingEmails,
    invalidDates: plan.invalidDates,
    ...result,
  };
}
