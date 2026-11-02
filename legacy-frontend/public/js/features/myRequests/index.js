import { createElement } from '../../core/dom/elements.js';
export function initializeMyRequests(api) {
  const list = document.querySelector('#my-requests-list');
  const feedback = document.querySelector('#my-requests-feedback');
  document.addEventListener('workspace-page', async (event) => {
    if (event.detail !== 'my-requests') return;
    feedback.textContent = 'กำลังโหลดรายการ…';
    try {
      const { records } = await api('/api/my-requests');
      list.replaceChildren();
      for (const entry of records) {
        const card = createElement('article', 'account-card');
        card.append(
          createElement('h2', '', `${entry.kind} · ${entry.name || entry.asset}`),
          createElement('p', '', `${entry.id} · ${entry.date} · ${entry.status}`),
        );
        list.append(card);
      }
      feedback.textContent = records.length
        ? `พบ ${records.length} รายการ`
        : 'ยังไม่มีรายการของคุณ';
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
  document.addEventListener('auth-cleared', () => {
    list.replaceChildren();
    feedback.textContent = '';
  });
}
