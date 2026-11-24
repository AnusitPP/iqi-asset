import { config } from '../src/core/config/config.js';
import { GoogleSheets } from '../src/integrations/google/googleSheets.js';
import { logError } from '../src/core/errors/errors.js';

async function setup() {
  const adapter = new GoogleSheets(config);
  await adapter.initialize();
  console.log('Google Sheets พร้อมใช้งาน');
}

setup().catch((error) => {
  logError(error, 'sheet setup');
  process.exitCode = 1;
});
