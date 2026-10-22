import { config } from './src/config.js';
import { GoogleSheets } from './src/googleSheets.js';
import { Records } from './src/records.js';
import { createApp, friendlyError } from './src/app.js';
import { lanAddresses } from './src/network.js';
import { reviewKey } from './src/reviewQueue.js';
const adapter = new GoogleSheets(config);
try {
  await adapter.initialize();
  if (await adapter.ensureSearchStatusColumn()) console.log('Added IQI column: สถานะการค้นหา');
  if (await adapter.ensureReviewSheet()) console.log('Prepared sheet: รอตรวจสอบ');
  const tables = await adapter.read();
  const status = tables[0].headers.indexOf('สถานะการค้นหา');
  const queued = new Set((await adapter.readReviewQueues()).entries.map((e) => e.key));
  for (const record of tables[0].records.filter(
    (r) => r.values[status] === 'รอค้นหา' && !queued.has(reviewKey(tables[0], r)),
  ))
    await adapter.setReviewSelection(tables[0], record, true);
  console.log(
    'Google Sheets connected:',
    tables
      .map((t) => `${t.sheet} (${t.records.length} rows / ${t.headers.length} columns)`)
      .join(', '),
  );
} catch (error) {
  console.error('Google Sheets:', friendlyError(error));
}
const server = createApp(new Records(adapter, config), config).listen(
  config.port,
  config.host,
  () => {
    console.log(`Local: http://localhost:${config.port}`);
    for (const ip of lanAddresses()) console.log(`Mobile / LAN: http://${ip}:${config.port}`);
  },
);
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `พอร์ต ${config.port} ถูกใช้งานอยู่ กรุณาปิดโปรแกรมที่ใช้พอร์ตนี้หรือแก้ PORT ใน .env`
      : 'เปิดเซิร์ฟเวอร์ไม่ได้',
  );
  process.exitCode = 1;
});
