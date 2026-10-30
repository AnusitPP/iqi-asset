import { createElement } from '../../core/dom/elements.js';
import { createProfileAvatar } from '../auth/avatar.js';
import { formatBangkokDisplayTimestamp } from '/shared/core/extensions/dates.js';
import { can } from '../auth/permissions.js';
export function initializeUserDetails(api, onSaved) {
  const dialog = document.querySelector('#user-detail-dialog');
  const content = document.querySelector('#user-detail-content');
  const form = document.querySelector('#user-access-form');
  const role = document.querySelector('#user-detail-role');
  const status = document.querySelector('#user-detail-status');
  const feedback = document.querySelector('#user-detail-feedback');
  const save = document.querySelector('#user-detail-save');
  const close = document.querySelector('#user-detail-close');
  let user = null,
    busy = false,
    generation = 0;
  function dismiss() {
    if (!busy) {
      generation++;
      dialog.close();
    }
  }
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismiss();
  });
  async function open(id, editing = false) {
    const request = ++generation;
    user = null;
    content.replaceChildren();
    form.hidden = true;
    feedback.textContent = 'กำลังโหลดข้อมูลผู้ใช้…';
    document.querySelector('#user-detail-title').textContent = editing
      ? 'จัดการสิทธิ์ผู้ใช้งาน'
      : 'ข้อมูลผู้ใช้งาน';
    if (!dialog.open) dialog.showModal();
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(id)}`);
      if (request !== generation) return;
      user = data.user;
      const identity = createElement('div', 'users-detail-identity');
      const text = createElement('div');
      text.append(createElement('h3', '', user.name), createElement('p', '', user.email));
      identity.append(createProfileAvatar(user.name, user.avatar_url), text);
      content.append(identity);
      const summary = createElement('dl', 'users-detail-summary');
      for (const [label, value] of [
        ['Role', user.role],
        ['สถานะ', user.status],
        ['เข้าใช้ครั้งแรก', user.created_at ? formatBangkokDisplayTimestamp(user.created_at) : '—'],
        [
          'เข้าใช้ล่าสุด',
          user.last_login_at ? formatBangkokDisplayTimestamp(user.last_login_at) : '—',
        ],
      ])
        summary.append(createElement('dt', '', label), createElement('dd', '', value));
      content.append(summary);
      feedback.textContent =
        user.role === 'SUPER_ADMIN' ? 'บัญชีหลักของระบบ · ไม่สามารถลดสิทธิ์หรือปิดบัญชีได้' : '';
      if (editing && can('USER_MANAGE') && user.role !== 'SUPER_ADMIN') {
        role.value = user.role;
        status.value = user.status;
        form.hidden = false;
      }
    } catch (error) {
      if (request === generation) feedback.textContent = error.message;
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !user || !can('USER_MANAGE') || user.role === 'SUPER_ADMIN') return;
    const request = generation;
    busy = true;
    save.disabled = role.disabled = status.disabled = true;
    close.disabled = true;
    feedback.textContent = 'กำลังบันทึก…';
    try {
      for (const [field, value] of [
        ['role', role.value],
        ['status', status.value],
      ]) {
        if (user[field] !== value) {
          const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/${field}`, {
            method: 'PATCH',
            body: JSON.stringify({ [field]: value }),
          });
          if (request !== generation) return;
          user = result.user;
        }
      }
      if (request !== generation) return;
      dialog.close();
      await onSaved();
    } catch (error) {
      if (request === generation) feedback.textContent = error.message;
    } finally {
      busy = false;
      save.disabled = role.disabled = status.disabled = close.disabled = false;
    }
  });
  return {
    open,
    clear() {
      generation++;
      user = null;
      dialog.close();
      content.replaceChildren();
      feedback.textContent = '';
    },
  };
}
