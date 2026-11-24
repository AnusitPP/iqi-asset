import { config } from './src/core/config/config.js';
import { logError } from './src/core/errors/errors.js';
import { lanAddresses } from './src/core/network/addresses.js';

import { adapter, app } from './src/runtime.js';

try {
  await adapter.initialize();

  console.log('Google Sheets connected:', config.sheets.join(', '));
} catch (error) {
  logError(error, 'local startup');
}

export default app;

const server = app.listen(config.port, config.host, () => {
  console.log(`Local: http://localhost:${config.port}`);

  for (const ip of lanAddresses()) {
    console.log(`Mobile / LAN: http://${ip}:${config.port}`);
  }
});

server.on('error', (error) => {
  logError(error, 'listener');
  console.error(
    error.code === 'EADDRINUSE'
      ? `พอร์ต ${config.port} ถูกใช้งานอยู่ กรุณาปิดโปรแกรมที่ใช้พอร์ตนี้หรือแก้ PORT ใน .env`
      : 'เปิดเซิร์ฟเวอร์ไม่ได้',
  );

  process.exitCode = 1;
});
