import { config } from './config.js';
import { GoogleSheets } from './googleSheets.js';
import { Records } from './records.js';
import { createApp } from './app.js';
import { StateStore } from './state.js';
import { INSPECTION_HEADER, REVIEW_DATE_HEADER } from './reviewQueue.js';
import { SEARCH_STATUS_HEADER } from './searchStatus.js';

export const state = new StateStore({ url: config.redisUrl, token: config.redisToken, prefix: config.statePrefix });
export const adapter = new GoogleSheets(config);
adapter.state = state;
const service = new Records(adapter, config);
let ready;
service.ready = () => {
  if (!ready) ready = (async () => {
    await adapter.initialize();
    const { data } = await adapter.api.spreadsheets.get({
      spreadsheetId: config.spreadsheetId, fields: 'sheets.properties',
    });
    const [table] = await adapter.read([config.sheets[0]]);
    if (!table.headers.includes(SEARCH_STATUS_HEADER))
      throw new Error('กรุณารัน npm run setup:sheets ก่อน deploy');
    for (const queue of [adapter.reviewQueue, adapter.iqiItQueue]) {
      const properties = data.sheets.find((sheet) => sheet.properties.title === queue.sheet)?.properties;
      if (!properties) throw new Error('กรุณารัน npm run setup:sheets ก่อน deploy');
      const rows = await queue.values();
      queue.validate(rows);
      if (rows[0]?.[12] !== REVIEW_DATE_HEADER || rows[0]?.[13] !== INSPECTION_HEADER)
        throw new Error('กรุณารัน npm run setup:sheets ก่อน deploy');
      queue.properties = properties;
    }
  })().catch((error) => { ready = undefined; throw error; });
  return ready;
};
export const app = createApp(service, { ...config, state });
