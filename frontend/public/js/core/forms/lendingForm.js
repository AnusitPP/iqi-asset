import { MAX_LOAN_DAYS } from '/shared/features/lending/status.js';
import { UI_MESSAGES } from '/shared/core/constants/messages.js';
import { calendarDaysBetween } from '/shared/core/extensions/dates.js';
import { initializeCatalogSearch } from '../components/catalog/search.js';
import {
  FORM_TEAMS,
  LOAN_TERMS,
  LOAN_NOTES,
  RETURN_TERMS,
} from '/shared/features/lending/formConstants.js';
export function initializeLendingForm(mode, api) {
  const selectElement = (selector) => document.querySelector(selector);
  let version = 0;
  const form = selectElement(`#${mode}-form`),
    feedback = selectElement(`#${mode}-feedback`);
  let requestId = crypto.randomUUID(),
    busy = false;
  const options = (select, values) => {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'เลือก';
    select.append(empty);
    for (const fieldValue of values) {
      const o = document.createElement('option');
      o.value = fieldValue;
      o.textContent = fieldValue;
      select.append(o);
    }
  };
  options(selectElement(`#${mode}-team`), FORM_TEAMS);
  const catalog = initializeCatalogSearch(mode, api);
  const terms = selectElement(`#${mode}-terms`);
  for (const text of mode === 'loan' ? [LOAN_TERMS, ...LOAN_NOTES] : [RETURN_TERMS]) {
    const p = document.createElement('p');
    p.textContent = text;
    terms.append(p);
  }
  form.addEventListener('input', () => {
    requestId = crypto.randomUUID();
  });
  form.addEventListener('change', () => {
    requestId = crypto.randomUUID();
  });
  form.addEventListener('reset', () => {
    requestId = crypto.randomUUID();
    feedback.textContent = '';
    catalog.clear();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const selected = catalog.selection();
    if (!selected) {
      feedback.textContent = 'กรุณาเลือกอุปกรณ์จากผลค้นหา';
      return;
    }
    const request = version;
    const body = {
      requestId,
      borrower: selectElement(`#${mode}-borrower`).value,
      team: selectElement(`#${mode}-team`).value,
      category: selected.category,
      selectedAsset: { asset: selected.asset, serial: selected.serial },
      identifier: selectElement(`#${mode}-identifier`).value,
      notes: selectElement(`#${mode}-notes`).value,
    };
    if (mode === 'loan') {
      Object.assign(body, {
        purpose: selectElement('#loan-purpose').value,
        start: selectElement('#loan-start').value,
        due: selectElement('#loan-due').value,
      });
      if (body.due < body.start || calendarDaysBetween(body.start, body.due) > MAX_LOAN_DAYS) {
        feedback.textContent = 'กำหนดคืนต้องไม่ก่อนวันที่ยืมและไม่เกิน 7 วัน';
        return;
      }
    } else body.date = selectElement('#return-date').value;
    busy = true;
    form
      .querySelectorAll('input,select,textarea,button')
      .forEach((element) => (element.disabled = true));
    feedback.textContent = UI_MESSAGES.SAVING;
    try {
      const result = await api(mode === 'loan' ? '/api/loans' : '/api/returns', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (request !== version) return;
      form.reset();
      feedback.textContent = `ส่ง${mode === 'loan' ? 'คำร้องยืม' : 'คำร้องคืน'}สำเร็จ · ${result.id} · รอเจ้าหน้าที่ดำเนินการ`;
    } catch (error) {
      if (request === version) feedback.textContent = error.message;
    } finally {
      busy = false;
      form
        .querySelectorAll('input,select,textarea,button')
        .forEach((element) => (element.disabled = false));
    }
  });

  return {
    clear() {
      version++;
      form.reset();
    },
  };
}
