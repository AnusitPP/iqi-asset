export function initializeLoanSearch(api) {
  const input = document.querySelector('#loan-assets');
  const results = document.querySelector('#loan-asset-results');
  const selected = document.querySelector('#loan-selected-assets');
  const message = document.querySelector('#loan-search-message');
  let records = null,
    pending = null,
    generation = 0;
  const choices = new Map();
  const close = () => {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const renderSelected = () => {
    selected.replaceChildren();
    for (const [row, record] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'loan-selected-item';
      button.textContent = (record.asset || record.name) + ' ×';
      button.setAttribute('aria-label', 'นำออก ' + (record.asset || record.name));
      button.addEventListener('click', () => {
        choices.delete(row);
        renderSelected();
        input.focus();
      });
      selected.append(button);
    }
    input.required = choices.size === 0;
    input.setCustomValidity('');
    message.textContent = 'เลือกแล้ว ' + choices.size + '/5 รายการ';
  };
  async function search() {
    const request = ++generation;
    const query = input.value.trim().toLocaleLowerCase();
    close();
    if (!query) return;
    message.textContent = 'กำลังค้นหาใน Appscriptdata…';
    try {
      if (!records) {
        pending ||= api('/api/dashboard')
          .then((data) => data.records)
          .finally(() => {
            pending = null;
          });
        records = await pending;
      }
      if (request !== generation) return;
      const matches = records.filter(
        (record) =>
          !choices.has(record.row) &&
          [record.asset, record.name, record.serial].some((value) =>
            String(value || '')
              .toLocaleLowerCase()
              .includes(query),
          ),
      );
      results.replaceChildren();
      message.textContent = matches.length
        ? 'พบ ' + matches.length + ' รายการ'
        : 'ไม่พบรายการใน Appscriptdata';
      for (const record of matches.slice(0, 20)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = [record.asset, record.name, record.serial].filter(Boolean).join(' · ');
        button.addEventListener('click', () => {
          if (choices.size >= 5) {
            message.textContent = 'เลือกได้สูงสุด 5 รายการ';
            return;
          }
          choices.set(record.row, record);
          input.value = '';
          close();
          renderSelected();
          input.focus();
        });
        results.append(button);
      }
      results.hidden = !matches.length;
      input.setAttribute('aria-expanded', String(!!matches.length));
    } catch (error) {
      if (request === generation)
        message.textContent = error.message || 'ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง';
    }
  }
  input.addEventListener('input', () => {
    input.setCustomValidity('');
    search();
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) search();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !results.hidden) {
      event.preventDefault();
      results.querySelector('button')?.focus();
    }
    if (event.key === 'Escape') {
      generation++;
      close();
    }
  });
  results.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.focus();
      close();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      (event.key === 'ArrowDown'
        ? event.target.nextElementSibling
        : event.target.previousElementSibling
      )?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target !== input && !results.contains(event.target)) close();
  });
  document.querySelector('#loan-form').addEventListener(
    'submit',
    (event) => {
      if (!choices.size) {
        event.preventDefault();
        event.stopImmediatePropagation();
        input.setCustomValidity('กรุณาเลือกครุภัณฑ์จากผลการค้นหา');
        input.reportValidity();
      }
    },
    true,
  );
  document.querySelector('#loan-form').addEventListener('reset', () => {
    generation++;
    choices.clear();
    records = null;
    close();
    renderSelected();
  });
}
