import { UI_MESSAGES } from '/shared/core/constants/messages.js';
import { createElement, createButton as createActionButton } from '../../core/dom/elements.js';
import { PHOTO_SLOTS, LEGACY_PHOTO_HEADERS } from '/shared/features/photos/slots.js';
import { initializeDashboardPhotos } from '../photos/dashboardPhotos.js';
export function initializeDashboardDetails({ api, state, renderDashboard }) {
  const modal = createElement('dialog', 'dashboard-dialog');
  modal.setAttribute('aria-label', 'รายละเอียดรายการ Dashboard');
  document.body.append(modal);
  const photoEditor = initializeDashboardPhotos({
    api,
    state,
    renderDashboard,
    openDetails: details,
    modal,
  });
  modal.addEventListener('close', () => photoEditor.clearPreviews());
  function details(record) {
    photoEditor.clearPreviews();
    modal.replaceChildren();
    const head = createElement('div', 'dash-detail-head');
    head.append(
      createElement('h2', '', record.asset),
      createActionButton('ปิด', 'button secondary', () => modal.close()),
    );
    modal.append(head, photoEditor.render(record));
    const fields = createElement('div', 'fields');
    let teamInput, notesInput;
    const message = createElement('p', 'dash-hint');
    message.setAttribute('role', 'status');
    const changed = () =>
      (teamInput && teamInput.value !== record.team) ||
      (notesInput && notesInput.value !== record.editableNotes);
    const saveDetails = createActionButton('บันทึกทีมและหมายเหตุ', 'button primary', async () => {
      if (state.saving || !changed()) return;
      const body = { revision: record.revision };
      if (teamInput && teamInput.value !== record.team) body.team = teamInput.value;
      if (notesInput && notesInput.value !== record.editableNotes) body.notes = notesInput.value;
      state.saving = true;
      saveDetails.disabled = true;
      if (teamInput) teamInput.disabled = true;
      if (notesInput) notesInput.disabled = true;
      message.textContent = UI_MESSAGES.SAVING;
      const request = state.version;
      try {
        const result = await api(`/api/dashboard/${record.row}/details`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        if (request !== state.version) return;
        state.data.records = state.data.records.map((sourceRecord) =>
          sourceRecord.row === record.row ? result.record : sourceRecord,
        );
        state.feedback = `บันทึกทีมและหมายเหตุของ ${record.asset} แล้ว`;
        state.saving = false;
        renderDashboard();
        details(result.record);
      } catch (error) {
        if (request === state.version) message.textContent = error.message;
      } finally {
        state.saving = false;
        if (teamInput) teamInput.disabled = false;
        if (notesInput) notesInput.disabled = false;
        saveDetails.disabled = !changed();
      }
    });
    saveDetails.disabled = true;
    state.data.headers.forEach((header, index) => {
      if ([...PHOTO_SLOTS, ...LEGACY_PHOTO_HEADERS, 'รูปครุภัณฑ์'].includes(header)) return;
      const field = createElement('div', 'field');
      field.append(createElement('div', 'field-label', header));
      if (header === 'ทีม') {
        teamInput = createElement('select', 'dash-detail-input');
        teamInput.setAttribute('aria-label', 'ทีม');
        for (const team of ['', ...state.data.teams]) {
          const option = createElement('option', '', team || 'ไม่ระบุทีม');
          option.value = team;
          teamInput.append(option);
        }
        teamInput.value = record.team;
        teamInput.addEventListener('change', () => {
          saveDetails.disabled = state.saving || !changed();
        });
        field.append(teamInput);
      } else if (header === 'หมายเหตุ') {
        notesInput = createElement('textarea', 'dash-detail-input');
        notesInput.setAttribute('aria-label', 'หมายเหตุ');
        notesInput.rows = 3;
        notesInput.maxLength = 5000;
        notesInput.value = record.editableNotes;
        notesInput.addEventListener('input', () => {
          saveDetails.disabled = state.saving || !changed();
        });
        field.append(notesInput);
      } else field.append(createElement('div', 'field-value', record.values[index] || '—'));
      fields.append(field);
    });
    modal.append(fields, saveDetails, message);
    if (!modal.open) modal.showModal();
  }

  return {
    open: details,
    clear() {
      photoEditor.clearPreviews();
      modal.close();
      modal.replaceChildren();
    },
  };
}
