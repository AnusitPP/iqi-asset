import { createProfileAvatar } from '../auth/avatar.js';
import { createElement, createButton } from '../../core/dom/elements.js';
import { formatBangkokDisplayTimestamp } from '/shared/core/extensions/dates.js';
import { auditActionTone } from './model.js';
export function renderAuditTable(body, entries, openDetails) {
  body.replaceChildren();
  for (const entry of entries) {
    const row = createElement('tr');
    const userCell = createElement('td');
    const user = createElement('div', 'audit-user');
    const name = entry.actor_name_snapshot || entry.actor_email_snapshot || 'ไม่ระบุตัวตน';
    const avatar = createProfileAvatar(name, entry.actor_avatar_url);
    const identity = createElement('div', 'audit-identity');
    identity.append(
      createElement('span', 'audit-user-name', name),
      createElement('span', 'audit-user-email', entry.actor_email_snapshot || 'ไม่พบข้อมูลบัญชี'),
    );
    user.append(avatar, identity);
    userCell.append(user);
    const entity = createElement('td');
    const code = createElement('span', 'audit-entity', entry.entity_id || '—');
    code.title = entry.entity_id || '';
    entity.append(code);
    const action = createElement('td');
    action.append(
      createElement(
        'span',
        `audit-action audit-action-${auditActionTone(entry.action)}`,
        entry.action,
      ),
    );
    const timestamp = createElement('td', 'audit-timestamp');
    const time = createElement('time', '', formatBangkokDisplayTimestamp(entry.created_at));
    time.dateTime = entry.created_at;
    timestamp.append(time);
    const details = createElement('td', 'audit-row-action');
    const button = createButton('ดูรายละเอียด', 'audit-detail-button', () => openDetails(entry));
    button.setAttribute('aria-label', `ดูรายละเอียด ${entry.action} ของ ${name}`);
    details.append(button);
    row.append(
      userCell,
      entity,
      action,
      createElement('td', 'audit-type', entry.entity_type || '—'),
      timestamp,
      details,
    );
    body.append(row);
  }
}
