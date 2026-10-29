import {
  FORM_TEAMS,
  LOAN_TYPES,
  RETURN_TYPES,
  LOAN_TERMS,
  LOAN_NOTES,
  RETURN_TERMS,
} from '/shared/loanForm.js';
export function initializeLoans(api) {
  const $ = (s) => document.querySelector(s);
  let version = 0;
  const resets = [];
  for (const mode of ['loan', 'return']) {
    const form = $(`#${mode}-form`),
      feedback = $(`#${mode}-feedback`);
    let requestId = crypto.randomUUID(),
      busy = false;
    const options = (select, values) => {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'เลือก';
      select.append(empty);
      for (const v of values) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.append(o);
      }
    };
    options($(`#${mode}-team`), FORM_TEAMS);
    options($(`#${mode}-category`), mode === 'loan' ? LOAN_TYPES : RETURN_TYPES);
    const terms = $(`#${mode}-terms`);
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
    });
    resets.push(() => form.reset());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      const request = version;
      const body = {
        requestId,
        borrower: $(`#${mode}-borrower`).value,
        team: $(`#${mode}-team`).value,
        category: $(`#${mode}-category`).value,
        identifier: $(`#${mode}-identifier`).value,
        notes: $(`#${mode}-notes`).value,
      };
      if (mode === 'loan') {
        Object.assign(body, {
          purpose: $('#loan-purpose').value,
          start: $('#loan-start').value,
          due: $('#loan-due').value,
        });
        if (
          body.due < body.start ||
          (Date.parse(body.due) - Date.parse(body.start)) / 86400000 > 7
        ) {
          feedback.textContent = 'กำหนดคืนต้องไม่ก่อนวันที่ยืมและไม่เกิน 7 วัน';
          return;
        }
      } else body.date = $('#return-date').value;
      busy = true;
      form.querySelectorAll('input,select,textarea,button').forEach((n) => (n.disabled = true));
      feedback.textContent = 'กำลังบันทึก…';
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
        form.querySelectorAll('input,select,textarea,button').forEach((n) => (n.disabled = false));
      }
    });
  }
  return {
    clear() {
      version++;
      resets.forEach((reset) => reset());
    },
  };
}
