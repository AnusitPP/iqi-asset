import { UI_MESSAGES } from '/shared/core/constants/messages.js';
import { selectElement, createElement, createButton as button } from '../../core/dom/elements.js';
import { todayBangkok, inspectionNote } from '/shared/core/extensions/dates.js';
import { editedValues } from './formValues.js';
import { displayFieldValue } from '/shared/core/formatters/labels.js';
export function initializeRecordDetails({ api, toast, getSearchQuery, refreshSearch }) {
  let currentRecord = null,
    isEditing = false,
    isSaving = false,
    inputs = [],
    baseline = [],
    hasPendingChanges = false,
    detailRequestGeneration = 0;
  const dialog = selectElement('#detail-dialog');
  function closeDetail() {
    if (isSaving) return;
    if (hasPendingChanges && !confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดรายละเอียดหรือไม่?'))
      return;
    detailRequestGeneration++;
    hasPendingChanges = false;
    dialog.close();
    document.body.classList.remove('modal-open');
  }
  selectElement('#close-detail').addEventListener('click', closeDetail);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDetail();
  });
  window.addEventListener('beforeunload', (event) => {
    if (hasPendingChanges || isSaving) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  async function openDetail(sheet, row) {
    const requestId = ++detailRequestGeneration;
    currentRecord = null;
    hasPendingChanges = false;
    isEditing = false;
    selectElement('#detail-title').textContent = 'กำลังโหลดรายละเอียด…';
    selectElement('#detail-source').textContent = 'FULL ROW VIEW';
    selectElement('#detail-content').replaceChildren(
      createElement('p', 'loading', 'กำลังอ่านข้อมูลล่าสุดจาก Google Sheets…'),
    );
    selectElement('#detail-actions').replaceChildren();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    try {
      const record = await api(`/api/record?sheet=${encodeURIComponent(sheet)}&row=${row}`);
      if (requestId !== detailRequestGeneration) return;
      currentRecord = record;
      renderRecordDetails();
    } catch (error) {
      if (requestId !== detailRequestGeneration) return;
      selectElement('#detail-title').textContent = 'โหลดรายละเอียดไม่ได้';
      selectElement('#detail-content').replaceChildren(
        createElement('div', 'alert error', error.message),
      );
    }
  }
  function renderRecordDetails() {
    selectElement('#detail-title').textContent =
      currentRecord.values[currentRecord.assetIndex] || 'รายละเอียดครุภัณฑ์';
    selectElement('#detail-source').textContent =
      `${currentRecord.label} / แถว ${currentRecord.row}`;
    const content = selectElement('#detail-content');
    content.replaceChildren();
    const context = createElement('div', 'detail-context');
    context.append(
      createElement(
        'span',
        currentRecord.editable ? 'badge editable' : 'badge readonly',
        currentRecord.editable ? 'แก้ไขได้' : 'ดูอย่างเดียว',
      ),
      createElement('span', 'column-count', `ข้อมูลครบ ${currentRecord.headers.length} คอลัมน์`),
    );
    content.append(context);
    if (isEditing) {
      content.append(
        createElement('p', 'edit-help', 'แก้ไขได้ทุกช่อง ตรวจสอบค่าทั้งหมดก่อนกดบันทึก'),
      );
      if (currentRecord.dateIndex !== null) {
        const datebar = createElement('div', 'date-shortcut');
        const hint = createElement('div');
        hint.append(
          createElement('strong', '', 'ตรวจสอบครุภัณฑ์วันนี้'),
          createElement(
            'p',
            '',
            currentRecord.dateMode === 'inspection-note'
              ? 'อัปเดตวันที่ในหมายเหตุ โดยคงข้อความอื่นไว้'
              : `ช่อง: ${currentRecord.headers[currentRecord.dateIndex]}`,
          ),
        );
        datebar.append(
          hint,
          button('ตั้งวันที่เป็นวันนี้', 'button today-button', () => {
            const input = inputs[currentRecord.dateIndex];
            const nextValue =
              currentRecord.dateMode === 'inspection-note'
                ? inspectionNote(input.value, todayBangkok())
                : todayBangkok();
            if (
              input.tagName === 'SELECT' &&
              ![...input.options].some((o) => o.value === nextValue)
            ) {
              toast(
                'ช่องวันที่ของแถวนี้จำกัดตัวเลือกในชีต จึงตั้งวันที่ไม่ได้ กรุณาตรวจกฎ dropdown ใน Google Sheets',
              );
              return;
            }
            input.value = nextValue;
            input.dispatchEvent(new Event('input'));
            input.focus();
            input.scrollIntoView({ block: 'center', behavior: 'smooth' });
            toast('ตั้งวันที่ในฟอร์มแล้ว กดบันทึกเพื่ออัปเดต Google Sheets');
          }),
        );
        content.append(datebar);
      } else
        content.append(
          createElement(
            'p',
            'alert warning',
            'ไม่พบคอลัมน์วันที่ตรวจสอบที่ชัดเจน ตั้งค่า IQI_DATE_HEADER ใน .env เพื่อเปิดใช้ปุ่มวันนี้',
          ),
        );
    }
    const fields = createElement('div', isEditing ? 'fields editing' : 'fields');
    inputs = [];
    baseline = [];
    currentRecord.headers.forEach((header, index) => {
      const field = createElement('div', 'field');
      const label = createElement(
        isEditing ? 'label' : 'div',
        'field-label',
        header || `คอลัมน์ ${index + 1} (ไม่มีชื่อ header)`,
      );
      const value = currentRecord.values[index];
      if (isEditing) {
        const rule = currentRecord.dropdowns?.[index];
        let input;
        if (rule?.strict) {
          input = document.createElement('select');
          const empty = createElement('option', '', '— ไม่ระบุ —');
          empty.value = '';
          input.append(empty);
          if (value && !rule.options.includes(value)) {
            const legacy = createElement(
              'option',
              '',
              `${displayFieldValue(header, value)} (ค่าปัจจุบันนอกตัวเลือก)`,
            );
            legacy.value = value;
            input.append(legacy);
          }
          rule.options.forEach((value) => {
            const option = createElement('option', '', displayFieldValue(header, value));
            option.value = value;
            input.append(option);
          });
        } else if (rule) {
          input = document.createElement('input');
          input.type = 'text';
          const list = createElement('datalist');
          list.id = `options-${index}`;
          rule.options.forEach((value) => {
            const option = createElement('option');
            option.value = value;
            list.append(option);
          });
          input.setAttribute('list', list.id);
          field.append(list);
        } else {
          input = document.createElement('textarea');
          input.rows = /รายละเอียด|หมายเหตุ|ประวัติ/.test(header) || value.length > 70 ? 3 : 1;
        }
        input.id = `field-${index}`;
        input.value = value;
        input.name = String(index);
        label.htmlFor = input.id;
        baseline.push(input.value);
        const changed = () => {
          hasPendingChanges = inputs.some((input, i) => input.value !== baseline[i]);
          updateSaveState();
        };
        input.addEventListener('input', changed);
        input.addEventListener('change', changed);
        inputs.push(input);
        field.append(label, input);
        if (rule)
          field.append(
            createElement(
              'p',
              'dropdown-hint',
              rule.strict
                ? 'ตัวเลือกตาม Google Sheets'
                : 'เลือกจาก Google Sheets หรือกรอกค่าอื่นได้ตามกฎในชีต',
            ),
          );
      } else
        field.append(
          label,
          createElement(
            'div',
            value ? 'field-value' : 'field-value blank',
            displayFieldValue(header, value) || '-',
          ),
        );
      fields.append(field);
    });
    content.append(fields);
    renderActions();
    selectElement('#detail-scroll').scrollTop = 0;
  }
  function renderActions() {
    const actions = selectElement('#detail-actions');
    actions.replaceChildren();
    if (!currentRecord.editable) {
      actions.append(
        createElement('span', 'action-note', 'อ่านข้อมูลจาก Google Sheets'),
        button('ปิดรายละเอียด', 'button secondary', closeDetail),
      );
      return;
    }
    if (!isEditing) {
      const edit = button(
        'แก้ไขข้อมูล',
        'button primary',
        () => {
          isEditing = true;
          renderRecordDetails();
        },
        'pencil',
      );
      edit.disabled = isSaving;
      actions.append(createElement('span', 'action-note', 'IQI · แก้ไขได้ทุกคอลัมน์'), edit);
      return;
    }
    const left = createElement('div', 'save-status');
    left.id = 'save-status';
    actions.append(
      left,
      button('ยกเลิก', 'button secondary', () => {
        if (hasPendingChanges && !confirm('ยกเลิกข้อมูลที่แก้ไขทั้งหมด?')) return;
        hasPendingChanges = false;
        isEditing = false;
        renderRecordDetails();
      }),
    );
    const saveButton = button('บันทึก', 'button primary', saveRecordChanges);
    saveButton.id = 'save-button';
    actions.append(saveButton);
    updateSaveState();
  }
  function updateSaveState() {
    if (!isEditing) return;
    selectElement('#save-status').textContent = hasPendingChanges
      ? 'มีการแก้ไขที่ยังไม่บันทึก'
      : 'ยังไม่มีการเปลี่ยนแปลง';
    selectElement('#save-button').disabled = !hasPendingChanges || isSaving;
  }
  async function saveRecordChanges() {
    if (isSaving || !hasPendingChanges) return;
    isSaving = true;
    selectElement('#save-button').disabled = true;
    selectElement('#save-button').textContent = UI_MESSAGES.SAVING;
    selectElement('#close-detail').disabled = true;
    selectElement('#detail-actions')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    inputs.forEach((input) => (input.disabled = true));
    selectElement('#detail-content')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = true));
    selectElement('#detail-save-error')?.remove();
    try {
      const values = editedValues(
        currentRecord.values,
        baseline,
        inputs.map((input) => input.value),
      );
      currentRecord = await api(`/api/iqi/${currentRecord.row}`, {
        method: 'PUT',
        body: JSON.stringify({
          sheet: currentRecord.sheet,
          revision: currentRecord.revision,
          values,
        }),
      });
      hasPendingChanges = false;
      isEditing = false;
      renderRecordDetails();
      toast('บันทึกสำเร็จ · อ่านข้อมูลล่าสุดจาก Google Sheets แล้ว');
      if (getSearchQuery() || selectElement('#pending-only').checked)
        await refreshSearch(getSearchQuery());
    } catch (error) {
      const alert = createElement('div', 'alert error', error.message);
      alert.id = 'detail-save-error';
      alert.setAttribute('role', 'alert');
      selectElement('#detail-content').prepend(alert);
      selectElement('#detail-scroll').scrollTop = 0;
    } finally {
      isSaving = false;
      selectElement('#close-detail').disabled = false;
      inputs.forEach((input) => (input.disabled = false));
      selectElement('#detail-content')
        .querySelectorAll('button')
        .forEach((b) => (b.disabled = false));
      renderActions();
    }
  }

  return {
    openDetail,
    hasUnsavedChanges: () => hasPendingChanges,
    clear() {
      detailRequestGeneration++;
      hasPendingChanges = false;
      currentRecord = null;
      isEditing = false;
      inputs = [];
      baseline = [];
      if (dialog.open) dialog.close();
      document.body.classList.remove('modal-open');
      selectElement('#detail-content').replaceChildren();
      selectElement('#detail-actions').replaceChildren();
    },
  };
}
