import { createElement } from '../../core/dom/elements.js';
import { can } from '../auth/permissions.js';
import { filterAuditEntries } from './model.js';
import { renderAuditTable } from './table.js';
import { initializeAuditDetails } from './details.js';
export function initializeAudit(api) {
  const body = document.querySelector('#audit-table-body');
  const feedback = document.querySelector('#audit-feedback');
  const form = document.querySelector('#audit-filter');
  const search = document.querySelector('#audit-search');
  const action = document.querySelector('#audit-action-filter');
  const type = document.querySelector('#audit-type-filter');
  const refresh = document.querySelector('#audit-refresh');
  const empty = document.querySelector('#audit-empty');
  const table = document.querySelector('#audit-table-wrap');
  const details = initializeAuditDetails();
  let records = [],
    generation = 0;
  function render() {
    const matches = filterAuditEntries(records, {
      query: search.value,
      action: action.value,
      type: type.value,
    });
    renderAuditTable(body, matches, details.open);
    table.hidden = !matches.length;
    empty.hidden = !!matches.length;
    empty.textContent = records.length
      ? 'ไม่พบรายการที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง'
      : 'ยังไม่มีประวัติการใช้งาน';
    feedback.textContent = `แสดง ${matches.length} จาก ${records.length} รายการล่าสุด`;
  }
  function populate(select, field, label) {
    const previous = select.value;
    select.replaceChildren(createElement('option', '', label));
    select.options[0].value = '';
    for (const value of [...new Set(records.map((entry) => entry[field]).filter(Boolean))].sort()) {
      const option = createElement('option', '', value);
      option.value = value;
      select.append(option);
    }
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  async function load() {
    if (!can('AUDIT_VIEW')) return;
    const request = ++generation;
    refresh.disabled = true;
    feedback.textContent = 'กำลังโหลดประวัติ…';
    document.querySelector('#audit-panel').setAttribute('aria-busy', 'true');
    try {
      const data = await api('/api/audit');
      if (request !== generation) return;
      records = data.records;
      populate(action, 'action', 'ทุกการกระทำ');
      populate(type, 'entity_type', 'ทุกประเภท');
      render();
    } catch (error) {
      if (request === generation) {
        records = [];
        body.replaceChildren();
        table.hidden = true;
        empty.hidden = true;
        feedback.textContent = error.message;
      }
    } finally {
      if (request === generation) {
        refresh.disabled = false;
        document.querySelector('#audit-panel').setAttribute('aria-busy', 'false');
      }
    }
  }
  form.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', render);
  action.addEventListener('change', render);
  type.addEventListener('change', render);
  document.querySelector('#audit-reset').addEventListener('click', () => {
    form.reset();
    render();
  });
  refresh.addEventListener('click', load);
  document.addEventListener('workspace-page', (event) => {
    if (event.detail === 'audit') load();
  });
  document.addEventListener('auth-cleared', () => {
    generation++;
    records = [];
    body.replaceChildren();
    form.reset();
    details.close();
    feedback.textContent = '';
    empty.hidden = true;
    table.hidden = true;
    refresh.disabled = false;
    document.querySelector('#audit-panel').setAttribute('aria-busy', 'false');
  });
}
