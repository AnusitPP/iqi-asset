import { CATALOG_MESSAGES } from './messages.js';
import { matchCatalog, catalogCategory } from '/shared/features/catalog/search.js';
export function initializeCatalogSearch(mode, api) {
  const input = document.querySelector(`#${mode}-category`),
    results = document.querySelector(`#${mode}-catalog-results`),
    message = document.querySelector(`#${mode}-catalog-message`),
    identifier = document.querySelector(`#${mode}-identifier`);
  let selected = null,
    version = 0;
  const close = () => {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const clear = () => {
    version++;
    selected = null;
    identifier.value = '';
    results.replaceChildren();
    close();
    message.textContent = CATALOG_MESSAGES.PROMPT;
    input.setCustomValidity('');
  };
  async function search() {
    const request = ++version;
    selected = null;
    identifier.value = '';
    close();
    input.setCustomValidity(CATALOG_MESSAGES.SELECT_RESULT);
    message.textContent = CATALOG_MESSAGES.LOADING;
    try {
      const data = await api('/api/loan-catalog');
      if (request !== version) return;
      const matches = matchCatalog(data.records, input.value);
      results.replaceChildren();
      for (const record of matches) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = [record.name, record.asset, record.serial].filter(Boolean).join(' · ');
        button.addEventListener('click', () => {
          selected = record;
          input.value = record.name;
          identifier.value = [record.asset, record.serial].filter(Boolean).join(' / ');
          input.setCustomValidity('');
          close();
          message.textContent = 'เลือกแล้ว: ' + record.asset;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.focus();
        });
        results.append(button);
      }
      message.textContent = matches.length
        ? `พบ ${matches.length} รายการ`
        : CATALOG_MESSAGES.NO_MATCHES;
      results.hidden = !matches.length;
      input.setAttribute('aria-expanded', String(!!matches.length));
    } catch (error) {
      if (request === version) message.textContent = error.message;
    }
  }
  input.addEventListener('input', search);
  input.addEventListener('focus', () => {
    if (!selected) search();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      version++;
      close();
    }
    if (e.key === 'ArrowDown' && !results.hidden) {
      e.preventDefault();
      results.querySelector('button')?.focus();
    }
  });
  results.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      input.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      (e.key === 'ArrowDown'
        ? e.target.nextElementSibling
        : e.target.previousElementSibling
      )?.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target !== input && !results.contains(e.target)) close();
  });
  return {
    clear,
    selection: () =>
      selected
        ? {
            asset: selected.asset,
            serial: selected.serial,
            category: catalogCategory(selected.name),
          }
        : null,
  };
}
