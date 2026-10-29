import { selectElement } from '../../core/dom/elements.js';
export function initializeReviewInspection({ api, getResults, onResultsChanged, toast }) {
  const inspectionDialog = selectElement('#inspection-dialog');
  let inspectionCurrent = null,
    inspectionSaving = false,
    inspectionOpenId = 0;
  function closeInspection() {
    if (inspectionSaving) return;
    inspectionOpenId++;
    inspectionCurrent = null;
    inspectionDialog.close();
  }
  selectElement('#inspection-close').addEventListener('click', closeInspection);
  selectElement('#inspection-status').addEventListener('change', () => {
    selectElement('#inspection-form').dataset.status = selectElement('#inspection-status').value;
  });
  inspectionDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeInspection();
  });
  async function openInspection(group, record) {
    const request = ++inspectionOpenId;
    inspectionCurrent = null;
    selectElement('#inspection-asset').textContent =
      `${record.asset || record.name || 'ครุภัณฑ์'} · ${group.label}`;
    selectElement('#inspection-status').value = '';
    selectElement('#inspection-error').hidden = true;
    selectElement('#inspection-save').disabled = true;
    selectElement('#inspection-date').textContent = 'กำลังอ่านผลตรวจล่าสุด…';
    inspectionDialog.showModal();
    try {
      const result = await api(
        `/api/review-inspection?sheet=${encodeURIComponent(group.sheet)}&row=${record.row}&revision=${encodeURIComponent(record.revision)}`,
      );
      if (request !== inspectionOpenId) return;
      inspectionCurrent = {
        sheet: group.sheet,
        row: record.row,
        revision: record.revision,
        ...result,
      };
      selectElement('#inspection-status').value = result.status;
      selectElement('#inspection-date').textContent = result.date
        ? `แก้ไขล่าสุด: ${result.date}`
        : 'วันที่จะลงอัตโนมัติเมื่อบันทึกผลตรวจ';
      selectElement('#inspection-save').disabled = false;
    } catch (error) {
      if (request !== inspectionOpenId) return;
      selectElement('#inspection-error').textContent = error.message;
      selectElement('#inspection-error').hidden = false;
    }
  }
  selectElement('#inspection-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!inspectionCurrent || inspectionSaving) return;
    inspectionSaving = true;
    selectElement('#inspection-save').disabled = true;
    selectElement('#inspection-close').disabled = true;
    selectElement('#inspection-status').disabled = true;
    selectElement('#inspection-error').hidden = true;
    try {
      const target = inspectionCurrent;
      const result = await api('/api/review-inspection', {
        method: 'PUT',
        body: JSON.stringify({ ...target, status: selectElement('#inspection-status').value }),
      });
      const lastResult = getResults();
      if (lastResult) {
        for (const group of lastResult.groups)
          for (const record of group.records)
            if ((record.sourceSheet || group.sheet) === target.sheet && record.row === target.row) {
              record.inspected = true;
              record.inspectionStatus = result.status;
            }
        onResultsChanged(lastResult);
      }
      inspectionDialog.close();
      inspectionOpenId++;
      inspectionCurrent = null;
      toast(
        result.unchanged
          ? 'สถานะเหมือนเดิม วันที่ไม่เปลี่ยน'
          : 'บันทึกสถานะและวันที่ตรวจเรียบร้อยแล้ว',
      );
    } catch (error) {
      selectElement('#inspection-error').textContent = error.message;
      selectElement('#inspection-error').hidden = false;
    } finally {
      inspectionSaving = false;
      selectElement('#inspection-save').disabled = false;
      selectElement('#inspection-close').disabled = false;
      selectElement('#inspection-status').disabled = false;
    }
  });

  return { openInspection };
}
