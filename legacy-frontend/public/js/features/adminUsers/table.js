import { createElement, createButton } from '../../core/dom/elements.js';
import { createProfileAvatar } from '../auth/avatar.js';
import { formatBangkokDisplayTimestamp } from '/shared/core/extensions/dates.js';
import { can } from '../auth/permissions.js';
export function renderUsersTable(body, users, openDetails) {
  body.replaceChildren();
  for (const user of users) {
    const row = createElement('tr');
    const nameCell = createElement('td');
    const identity = createElement('div', 'users-table-identity');
    const text = createElement('div');
    text.append(
      createElement('span', 'users-table-name', user.name || 'ไม่ระบุชื่อ'),
      createElement('span', 'users-table-account', 'บัญชี Google Workspace'),
    );
    identity.append(createProfileAvatar(user.name || user.email, user.avatar_url), text);
    nameCell.append(identity);
    const role = createElement('td');
    role.append(
      createElement('span', `users-role users-role-${user.role.toLowerCase()}`, user.role),
    );
    const status = createElement('td');
    const badge = createElement('span', `users-status users-status-${user.status.toLowerCase()}`);
    const dot = createElement('span', 'users-status-dot');
    dot.setAttribute('aria-hidden', 'true');
    badge.append(
      dot,
      document.createTextNode(user.status === 'ACTIVE' ? 'ใช้งานอยู่' : 'ปิดใช้งาน'),
    );
    status.append(badge);
    const dateCell = (value) => {
      const cell = createElement('td', 'users-table-date');
      if (value) {
        const time = createElement('time', '', formatBangkokDisplayTimestamp(value));
        time.dateTime = value;
        cell.append(time);
      } else cell.textContent = '—';
      return cell;
    };
    const actions = createElement('td', 'users-table-actions');
    const menu = createElement('details', 'users-row-menu');
    const trigger = createElement('summary', '', '⋮');
    trigger.setAttribute('aria-label', 'จัดการผู้ใช้ ' + user.email);
    const options = createElement('div', 'users-row-options');
    options.append(
      createButton('ดูข้อมูลผู้ใช้งาน', 'users-menu-item', () => {
        menu.open = false;
        openDetails(user.id);
      }),
    );
    if (can('USER_MANAGE') && user.role !== 'SUPER_ADMIN')
      options.append(
        createButton('จัดการสิทธิ์', 'users-menu-item', () => {
          menu.open = false;
          openDetails(user.id, true);
        }),
      );
    else if (user.role === 'SUPER_ADMIN')
      options.append(createElement('span', 'users-owner-note', 'บัญชีหลัก · ล็อกสิทธิ์'));
    menu.append(trigger, options);
    actions.append(menu);
    row.append(
      nameCell,
      createElement('td', 'users-table-email', user.email),
      role,
      status,
      dateCell(user.created_at),
      dateCell(user.last_login_at),
      actions,
    );
    body.append(row);
  }
}
