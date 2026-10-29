import { INSPECTION_HEADER, REVIEW_DATE_HEADER } from './features/review/queue.js';
import { SEARCH_STATUS_HEADER } from '../../shared/features/records/searchStatus.js';

const setupRequired = () =>
  Object.assign(new Error('กรุณารัน npm run setup:sheets ก่อน deploy'), { status: 422 });
export function runtimeReadiness(adapter) {
  let ready;
  return () => {
    if (!ready)
      ready = (async () => {
        await adapter.initialize();
        const { data } = await adapter.api.spreadsheets.get({
          spreadsheetId: adapter.config.spreadsheetId,
          fields: 'sheets.properties',
        });
        const [table] = await adapter.read([adapter.config.sheets[0]]);
        if (!table.headers.includes(SEARCH_STATUS_HEADER)) throw setupRequired();
        for (const queue of [adapter.reviewQueue, adapter.iqiItQueue]) {
          const properties = data.sheets.find(
            (sheet) => sheet.properties.title === queue.sheet,
          )?.properties;
          if (!properties) throw setupRequired();
          const rows = await queue.values();
          queue.validate(rows);
          if (rows[0]?.[12] !== REVIEW_DATE_HEADER || rows[0]?.[13] !== INSPECTION_HEADER)
            throw setupRequired();
          queue.properties = properties;
        }
      })().catch((error) => {
        ready = undefined;
        throw error;
      });
    return ready;
  };
}
