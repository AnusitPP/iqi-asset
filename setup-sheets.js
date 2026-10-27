import { config } from './src/config.js';
import { GoogleSheets } from './src/googleSheets.js';
import { reviewKey } from './src/reviewQueue.js';
const adapter = new GoogleSheets(config);
await adapter.initialize();
await adapter.ensureSearchStatusColumn();
await adapter.ensureReviewSheet();
const [table] = await adapter.read([config.sheets[0]]);
const column = table.headers.indexOf('สถานะการค้นหา');
const queued = new Set((await adapter.readReviewQueues()).entries.map((entry) => entry.key));
for (const record of table.records.filter((record) =>
  record.values[column] === 'รอค้นหา' && !queued.has(reviewKey(table, record))))
  await adapter.setReviewSelection(table, record, true);
console.log('Google Sheets พร้อมใช้งาน');
