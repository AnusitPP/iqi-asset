import { selectElement } from '../dom/elements.js';
export function createConnection({ api, setCsrf, onError }) {
  return async function connectGoogleSheets() {
    try {
      const status = await api('/api/status');
      setCsrf(status.csrf);
      selectElement('#connection').className = 'connection online';
      selectElement('#connection-text').textContent = 'Google Sheets เชื่อมต่อแล้ว';
      for (const [field, id] of [
        ['reviewUrl', 'review-sheet-link'],
        ['iqiItUrl', 'iqi-it-sheet-link'],
      ])
        if (status[field]) {
          selectElement('#' + id).href = status[field];
          selectElement('#' + id).hidden = false;
        }
      return true;
    } catch (error) {
      selectElement('#connection').className = 'connection offline';
      selectElement('#connection-text').textContent = 'ยังไม่เชื่อมต่อ';
      onError(error.message);
      return false;
    }
  };
}
