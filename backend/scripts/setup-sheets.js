import { config } from '../src/config/config.js';
import { GoogleSheets } from '../src/integrations/google/googleSheets.js';
import { reviewKey } from '../src/services/review/reviewQueue.js';
import { logError } from '../src/utils/errors.js';

async function setup() {
  const adapter = new GoogleSheets(config);
  await adapter.initialize();
  await adapter.ensureSearchStatusColumn();
  await adapter.ensureReviewSheet();
  const [table] = await adapter.read([config.sheets[0]]);
  const column = table.headers.indexOf('สถานะการค้นหา');
  const queued = new Set((await adapter.readReviewQueues()).entries.map((entry) => entry.key));
  for (const record of table.records.filter(
    (record) => record.values[column] === 'รอค้นหา' && !queued.has(reviewKey(table, record)),
  ))
    await adapter.setReviewSelection(table, record, true);
  console.log('Google Sheets พร้อมใช้งาน');
}

setup().catch((error) => {
  logError(error, 'sheet setup');
  process.exitCode = 1;
});
