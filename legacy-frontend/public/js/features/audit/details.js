import { createElement } from '../../core/dom/elements.js';
import { formatBangkokDisplayTimestamp } from '/shared/core/extensions/dates.js';
function readableData(value) {
  if (!value) return 'ไม่มีข้อมูล';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
export function initializeAuditDetails() {
  const dialog = document.querySelector('#audit-detail-dialog');
  const content = document.querySelector('#audit-detail-content');
  document.querySelector('#audit-detail-close').addEventListener('click', () => dialog.close());
  return {
    close() {
      dialog.close();
      content.replaceChildren();
    },
    open(entry) {
      document.querySelector('#audit-detail-title').textContent = entry.action;
      content.replaceChildren();
      const summary = createElement('dl', 'audit-detail-summary');
      for (const [label, value] of [
        ['ผู้ใช้งาน', entry.actor_name_snapshot || 'ไม่ระบุตัวตน'],
        ['อีเมล', entry.actor_email_snapshot || '—'],
        ['ประเภท', entry.entity_type || '—'],
        ['Entity ID', entry.entity_id || '—'],
        ['วันและเวลา', formatBangkokDisplayTimestamp(entry.created_at)],
        ['Audit ID', entry.id],
      ])
        summary.append(createElement('dt', '', label), createElement('dd', '', value));
      content.append(summary);
      const changes = createElement('div', 'audit-detail-changes');
      for (const [label, value] of [
        ['ก่อนเปลี่ยนแปลง', entry.before_data],
        ['หลังเปลี่ยนแปลง', entry.after_data],
      ]) {
        const section = createElement('section');
        section.append(
          createElement('h3', '', label),
          createElement('pre', '', readableData(value)),
        );
        changes.append(section);
      }
      content.append(changes);
      dialog.showModal();
    },
  };
}
