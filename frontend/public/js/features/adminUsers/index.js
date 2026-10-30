import { can } from '../auth/permissions.js';
import { initializeUserDetails } from './details.js';
import { renderUsersTable } from './table.js';
const PAGE_SIZE = 10;
export function initializeAdminUsers(api) {
  const panel = document.querySelector('#users-panel');
  const feedback = document.querySelector('#users-feedback');
  const body = document.querySelector('#users-table-body');
  const filter = document.querySelector('#users-filter');
  const previous = document.querySelector('#users-previous');
  const next = document.querySelector('#users-next');
  const table = document.querySelector('#users-table-wrap');
  const empty = document.querySelector('#users-empty');
  const refresh = document.querySelector('#users-refresh');
  let records = [],
    page = 0,
    generation = 0;
  const details = initializeUserDetails(api, async () => {
    await load();
    feedback.textContent = 'บันทึกสิทธิ์ผู้ใช้งานแล้ว';
  });
  function render() {
    const start = page * PAGE_SIZE;
    renderUsersTable(body, records.slice(start, start + PAGE_SIZE), details.open);
    table.hidden = !records.length;
    empty.hidden = !!records.length;
    document.querySelector('#users-count').textContent = records.length;
    feedback.textContent = records.length
      ? `แสดง ${start + 1}–${Math.min(start + PAGE_SIZE, records.length)} จาก ${records.length} บัญชี · เรียงตามการเข้าใช้ล่าสุด`
      : 'ไม่พบผู้ใช้งาน';
    previous.disabled = page === 0;
    next.disabled = start + PAGE_SIZE >= records.length;
    document.querySelector('#users-page').textContent =
      `หน้า ${page + 1} / ${Math.max(1, Math.ceil(records.length / PAGE_SIZE))}`;
  }
  async function load() {
    if (!can('USER_VIEW')) return;
    const request = ++generation;
    feedback.textContent = 'กำลังโหลดผู้ใช้งาน…';
    refresh.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    try {
      const { records: data } = await api(
        '/api/admin/users?' + new URLSearchParams(new FormData(filter)),
      );
      if (request !== generation) return;
      records = data.sort(
        (a, b) =>
          (Date.parse(b.last_login_at || b.created_at) || 0) -
            (Date.parse(a.last_login_at || a.created_at) || 0) ||
          a.name.localeCompare(b.name, 'th'),
      );
      page = 0;
      render();
    } catch (error) {
      if (request === generation) {
        records = [];
        render();
        feedback.textContent = error.message;
      }
    } finally {
      if (request === generation) {
        refresh.disabled = false;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  }
  filter.addEventListener('submit', (event) => {
    event.preventDefault();
    load();
  });
  for (const select of filter.querySelectorAll('select')) select.addEventListener('change', load);
  document.querySelector('#users-reset').addEventListener('click', () => {
    filter.reset();
    load();
  });
  refresh.addEventListener('click', load);
  previous.addEventListener('click', () => {
    if (page > 0) {
      page--;
      render();
    }
  });
  next.addEventListener('click', () => {
    if ((page + 1) * PAGE_SIZE < records.length) {
      page++;
      render();
    }
  });
  body.addEventListener(
    'toggle',
    (event) => {
      const target = event.target;
      if (target.matches('details[open]'))
        for (const menu of body.querySelectorAll('details[open]'))
          if (menu !== target) menu.open = false;
    },
    true,
  );
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      for (const menu of body.querySelectorAll('details[open]')) menu.open = false;
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !event.target.closest('.users-row-menu'))
      for (const menu of body.querySelectorAll('details[open]')) menu.open = false;
  });
  document.addEventListener('workspace-page', (event) => {
    if (event.detail === 'users') load();
  });
  document.addEventListener('auth-cleared', () => {
    generation++;
    records = [];
    body.replaceChildren();
    filter.reset();
    details.clear();
    feedback.textContent = '';
    panel.hidden = true;
    panel.setAttribute('aria-busy', 'false');
    refresh.disabled = false;
  });
}
