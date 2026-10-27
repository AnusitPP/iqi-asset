import { setUploadLimit } from './photos.js';
import { todayBangkok, inspectionNote, inspectionAge } from './dates.js';
import { editedValues } from './formValues.js';
import { debounce } from './debounce.js';
import { displayFieldValue } from './labels.js';
import { copyText } from './clipboard.js';
import { icon, initializeIcons } from './icons.js';
import { initializeDashboard } from './dashboard.js';
const $ = (selector) => document.querySelector(selector);
initializeIcons(document);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className, action, iconName) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  if (iconName) node.append(icon(iconName));
  return node;
}
let csrf = '',
  current = null,
  editing = false,
  saving = false,
  inputs = [],
  baseline = [],
  lastQuery = '',
  dirty = false,
  openId = 0;
let searchId = 0,
  searchController = null;
const initialResults = $('#results').cloneNode(true);
let lastResult = null;
const pendingWrites = new Set();
const pendingKey = (sheet, row) => JSON.stringify([sheet, row]);
const authDialog = $('#auth-dialog');
let authenticated = false;
const dashboard = initializeDashboard({
  api,
  isAuthenticated: () => authenticated,
  onLogin: () => showLogin(),
});
function showLogin() {
  authenticated = false;
  dashboard.clear();
  delayedSearch.cancel();
  invalidateSearch();
  $('#logout-button').hidden = true;
  if (!authDialog.open) authDialog.showModal();
  $('#auth-password').focus();
}
function invalidateSearch() {
  searchId++;
  searchController?.abort();
  setBusy(false);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-IQI-Request': csrf, ...options.headers },
  });
  const data = await response.json();
  if (response.status === 401 && !url.startsWith('/api/auth/')) showLogin();
  if (!response.ok) throw new Error(data.error || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
  return data;
}
async function connect() {
  try {
    const status = await api('/api/status');
    csrf = status.csrf;
    $('#connection').className = 'connection online';
    $('#connection-text').textContent = 'Google Sheets เชื่อมต่อแล้ว';
    if (status.reviewUrl) {
      $('#review-sheet-link').href = status.reviewUrl;
      $('#review-sheet-link').hidden = false;
    }
    if (status.iqiItUrl) {
      $('#iqi-it-sheet-link').href = status.iqiItUrl;
      $('#iqi-it-sheet-link').hidden = false;
    }
    return true;
  } catch (error) {
    $('#connection').className = 'connection offline';
    $('#connection-text').textContent = 'ยังไม่เชื่อมต่อ';
    showError(error.message);
    return false;
  }
}
function showError(message) {
  $('#page-error').textContent = message;
  $('#page-error').hidden = false;
}
function toast(message) {
  const node = $('#toast');
  (dialog.open ? dialog : document.body).append(node);
  node.textContent = message;
  node.hidden = false;
  setTimeout(() => {
    node.hidden = true;
  }, 4500);
}
function setBusy(busy) {
  const target = $('#search-button');
  target.disabled = busy;
  target.replaceChildren(document.createTextNode(busy ? 'กำลังค้นหา…' : 'ค้นหา'));
  if (!busy) target.append(icon('search'));
  $('#results').setAttribute('aria-busy', String(busy));
}
async function search(query) {
  delayedSearch.cancel();
  invalidateSearch();
  const requestId = searchId;
  const controller = new AbortController();
  searchController = controller;
  lastQuery = query;
  $('#page-error').hidden = true;
  setBusy(true);
  try {
    if (!csrf && !(await connect())) return;
    if (requestId !== searchId) return;
    const result = await api(
      `/api/search?q=${encodeURIComponent(query)}&pendingOnly=${$('#pending-only').checked ? '1' : '0'}`,
      { signal: controller.signal },
    );
    if (requestId === searchId) renderResults(result);
  } catch (error) {
    if (requestId !== searchId || error.name === 'AbortError') return;
    showError(error.message);
    $('#results').replaceChildren(
      el('div', 'result-failure', 'ยังโหลดผลค้นหาไม่ได้ กรุณาลองพิมพ์หรือกดค้นหาอีกครั้ง'),
    );
  } finally {
    if (requestId === searchId) setBusy(false);
  }
}
const delayedSearch = debounce(search, 300);
function onQueryInput(event) {
  delayedSearch.cancel();
  invalidateSearch();
  $('#page-error').hidden = true;
  const query = $('#query').value.trim();
  lastQuery = query;
  if (!query && !$('#pending-only').checked) {
    lastResult = null;
    $('#results').replaceChildren(...initialResults.cloneNode(true).childNodes);
    return;
  }
  $('#results').replaceChildren(el('div', 'loading', 'กำลังค้นหาข้อมูล…'));
  if (!event.isComposing) delayedSearch(query);
}
$('#query').addEventListener('input', onQueryInput);
$('#query').addEventListener('compositionend', onQueryInput);
$('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = $('#query').value.trim();
  if (query || $('#pending-only').checked) search(query);
});
$('#pending-only').addEventListener('change', () => {
  onQueryInput({ isComposing: false });
  const query = $('#query').value.trim();
  if (query || $('#pending-only').checked) search(query);
});
async function togglePending(record, group, control) {
  const sourceSheet = record.sourceSheet || group.sheet;
  const key = pendingKey(sourceSheet, record.row);
  if (pendingWrites.has(key)) return;
  const shown = lastResult;
  const searchAtClick = searchId;
  pendingWrites.add(key);
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  try {
    const pending = !record.pending;
    const saved = await api('/api/review-selection', {
      method: 'PUT',
      body: JSON.stringify({
        sheet: sourceSheet,
        row: record.row,
        revision: record.revision,
        pending,
      }),
    });
    record.pending = saved.pending;
    record.revision = saved.revision;
    const query = $('#query').value.trim();
    if (query || $('#pending-only').checked) await search(query);
    else if (lastResult === shown && searchId === searchAtClick) renderResults(shown);
    toast(
      record.pending
        ? `ส่งข้อมูลไปชีต ${saved.reviewSheet || 'รอตรวจสอบ'} แล้ว`
        : `นำรายการออกจากชีต ${saved.reviewSheet || 'รอตรวจสอบ'} แล้ว`,
    );
  } catch (error) {
    showError(error.message);
    toast('บันทึกสถานะไม่สำเร็จ กรุณาค้นหาใหม่แล้วลองอีกครั้ง');
  } finally {
    pendingWrites.delete(key);
    document.querySelectorAll('.pending-heart').forEach((node) => {
      if (node.dataset.pendingKey === key) {
        node.disabled = false;
        node.removeAttribute('aria-busy');
      }
    });
  }
}
function renderResults(result) {
  lastResult = result;
  const today = todayBangkok();
  const container = $('#results');
  container.replaceChildren();
  const heading = el('div', 'results-heading');
  const text = el('div');
  text.append(
    el('div', 'eyebrow', 'SEARCH RESULTS'),
    el(
      'h2',
      '',
      !result.query && result.pendingOnly
        ? 'รายการรอตรวจสอบทั้งหมด'
        : `ผลการค้นหา “${result.query}”`,
    ),
  );
  const total = result.groups.reduce((n, g) => n + g.count, 0);
  heading.append(
    text,
    el('span', 'result-total', `${total} รายการ / ${result.groups.length} กลุ่ม`),
  );
  container.append(heading);
  const groups = el('div', 'result-groups');
  result.groups
    .filter((group) => !result.pendingOnly || group.count > 0)
    .forEach((group, index) => {
      const card = el('section', 'result-group');
      if (group.reviewGroup) card.classList.add('review-group');
      const header = el('div', 'group-header');
      const title = el('div', 'group-title');
      const mark = el('span', `sheet-symbol sheet-${index}`);
      mark.append(icon('sheet'));
      const name = el('div');
      name.append(
        el('h3', '', group.label),
        el(
          'span',
          'group-permission',
          group.reviewGroup
            ? 'รายการในชีต IQI + IT'
            : group.editable
              ? 'อ่านและแก้ไขได้'
              : 'ดูอย่างเดียว',
        ),
      );
      title.append(mark, name);
      header.append(
        title,
        el('span', group.count ? 'count found' : 'count', `${group.count} รายการ`),
      );
      card.append(header);
      if (group.sheet !== group.label) card.append(el('p', 'actual-sheet', `แท็บ: ${group.sheet}`));
      if (group.count && group.matchType === 'fallback')
        card.append(el('p', 'fallback-note', 'พบจากเลขเก่า 2 ส่วนท้าย'));
      if (!group.count) {
        const empty = el('div', 'group-empty');
        empty.append(
          el('span', '', '—'),
          el(
            'p',
            '',
            result.pendingOnly ? 'ไม่พบรายการรอค้นหา' : 'ไม่พบข้อมูลที่ตรงกันใน Sheet นี้',
          ),
        );
        card.append(empty);
      }
      group.records.forEach((record) => {
        const sourceSheet = record.sourceSheet || group.sheet;
        const item = el(
          'article',
          `result-item${record.inspected && record.pending ? ' is-inspected' : ''}`,
        );
        item.dataset.inspectionStatus = record.inspectionStatus || '';
        if (record.inspected && record.pending)
          item.setAttribute('aria-label', `${record.asset || 'ครุภัณฑ์'} บันทึกผลตรวจแล้ว`);
        const topline = el('div', 'result-item-top');
        const code = el('h4', 'asset-code', record.asset || '—');
        code.title = record.asset || '—';
        const codeGroup = el('div', 'asset-code-group');
        codeGroup.append(code);
        if (record.asset) {
          const copy = button(
            '',
            'copy-code',
            async () => {
              try {
                await copyText(record.asset);
                toast('คัดลอกเลขครุภัณฑ์แล้ว');
              } catch {
                toast('คัดลอกไม่ได้ กรุณาเลือกและคัดลอกเลขจากหน้ารายละเอียด');
              }
            },
            'copy',
          );
          copy.setAttribute('aria-label', `คัดลอกเลขครุภัณฑ์ ${record.asset}`);
          copy.title = 'คัดลอกเลขครุภัณฑ์';
          codeGroup.append(copy);
        }
        topline.append(codeGroup);
        const age = inspectionAge(record.inspectionDate, today);
        const stamp = el('div', 'inspection-stamp');
        if (age) {
          const elapsed =
            age.days === 0
              ? 'วันนี้'
              : age.days > 0
                ? `${age.days.toLocaleString('th-TH')} วัน`
                : `อีก ${Math.abs(age.days).toLocaleString('th-TH')} วัน`;
          stamp.textContent = `${age.date} · ${elapsed}`;
          stamp.title = `วันที่ตรวจ ${age.date} · ${age.days > 0 ? 'ผ่านมา ' : ''}${elapsed}`;
        } else
          stamp.append(
            el(
              'span',
              'inspection-missing',
              record.inspectionDate ? 'วันที่ตรวจไม่ถูกต้อง' : 'ไม่ระบุวันที่ตรวจ',
            ),
          );
        topline.append(stamp);
        {
          const heart = button(
            '',
            `pending-heart${record.pending ? ' is-pending' : ''}`,
            () => togglePending(record, group, heart),
            'heart',
          );
          heart.dataset.row = String(record.row);
          heart.dataset.pendingKey = pendingKey(sourceSheet, record.row);
          heart.setAttribute('aria-pressed', String(record.pending));
          heart.setAttribute(
            'aria-label',
            `${record.pending ? 'ยกเลิกรอค้นหา' : 'ตั้งสถานะรอค้นหา'} ${record.asset}`,
          );
          heart.title = record.pending ? 'กดเพื่อนำออกจากรอตรวจสอบ' : 'กดเพื่อคัดลอกไปรอตรวจสอบ';
          heart.disabled = pendingWrites.has(pendingKey(sourceSheet, record.row));
          topline.append(heart);
        }
        const description = el(
          'p',
          'asset-description',
          [record.name || 'ไม่ระบุรายการ', record.brand].filter(Boolean).join(' · '),
        );
        description.title = description.textContent;
        item.append(topline, description);
        const identity = el('div', 'identity-line');
        const identityLabels = [];
        for (const [label, value] of [
          ['ชื่อ', record.owner],
          ['ชื่อย่อ', record.initials],
          ['ชื่อเล่น', record.nickname],
          ['ทีม', displayFieldValue('ทีม', record.team || '')],
        ]) {
          const part = el(
            'span',
            label === 'ชื่อ' ? 'identity-owner' : 'identity-extra',
            value || '-',
          );
          part.title = `${label}: ${value || '-'}`;
          identityLabels.push(part.title);
          identity.append(part);
        }
        identity.setAttribute('aria-label', identityLabels.join(' · '));
        identity.title = identityLabels.join(' · ');
        item.append(identity);
        if (record.pending && record.reviewSheet)
          item.append(el('p', 'review-location', `อยู่ในชีต ${record.reviewSheet}`));
        item.append(
          button(
            'ดูรายละเอียด',
            'button detail-button',
            () => openDetail(sourceSheet, record.row),
            'arrow',
          ),
        );
        if (record.pending)
          item.append(
            button(
              'บันทึกผลตรวจ',
              'button inspection-button',
              () => openInspection({ ...group, sheet: sourceSheet }, record),
              'check',
            ),
          );
        card.append(item);
      });
      groups.append(card);
    });
  container.append(groups);
  if (!total)
    container.append(
      el(
        'p',
        'no-results-help',
        result.pendingOnly
          ? 'ไม่พบรายการรอค้นหาที่ตรงกับตัวกรอง'
          : 'ไม่พบเลขนี้ในทั้ง 3 Sheet ลองตรวจสอบตัวเลขและเครื่องหมายขีดอีกครั้ง',
      ),
    );
}
const dialog = $('#detail-dialog');
const inspectionDialog = $('#inspection-dialog');
let inspectionCurrent = null,
  inspectionSaving = false,
  inspectionOpenId = 0;
function closeInspection() {
  if (inspectionSaving) return;
  inspectionOpenId++;
  inspectionCurrent = null;
  inspectionDialog.close();
}
$('#inspection-close').addEventListener('click', closeInspection);
$('#inspection-status').addEventListener('change', () => {
  $('#inspection-form').dataset.status = $('#inspection-status').value;
});
inspectionDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeInspection();
});
async function openInspection(group, record) {
  const request = ++inspectionOpenId;
  inspectionCurrent = null;
  $('#inspection-asset').textContent =
    `${record.asset || record.name || 'ครุภัณฑ์'} · ${group.label}`;
  $('#inspection-status').value = '';
  $('#inspection-error').hidden = true;
  $('#inspection-save').disabled = true;
  $('#inspection-date').textContent = 'กำลังอ่านผลตรวจล่าสุด…';
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
    $('#inspection-status').value = result.status;
    $('#inspection-date').textContent = result.date
      ? `แก้ไขล่าสุด: ${result.date}`
      : 'วันที่จะลงอัตโนมัติเมื่อบันทึกผลตรวจ';
    $('#inspection-save').disabled = false;
  } catch (error) {
    if (request !== inspectionOpenId) return;
    $('#inspection-error').textContent = error.message;
    $('#inspection-error').hidden = false;
  }
}
$('#inspection-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!inspectionCurrent || inspectionSaving) return;
  inspectionSaving = true;
  $('#inspection-save').disabled = true;
  $('#inspection-close').disabled = true;
  $('#inspection-status').disabled = true;
  $('#inspection-error').hidden = true;
  try {
    const target = inspectionCurrent;
    const result = await api('/api/review-inspection', {
      method: 'PUT',
      body: JSON.stringify({ ...target, status: $('#inspection-status').value }),
    });
    if (lastResult) {
      for (const group of lastResult.groups)
        for (const record of group.records)
          if ((record.sourceSheet || group.sheet) === target.sheet && record.row === target.row) {
            record.inspected = true;
            record.inspectionStatus = result.status;
          }
      renderResults(lastResult);
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
    $('#inspection-error').textContent = error.message;
    $('#inspection-error').hidden = false;
  } finally {
    inspectionSaving = false;
    $('#inspection-save').disabled = false;
    $('#inspection-close').disabled = false;
    $('#inspection-status').disabled = false;
  }
});
function closeDetail() {
  if (saving) return;
  if (dirty && !confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดรายละเอียดหรือไม่?')) return;
  openId++;
  dirty = false;
  dialog.close();
  document.body.classList.remove('modal-open');
}
$('#close-detail').addEventListener('click', closeDetail);
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDetail();
});
window.addEventListener('beforeunload', (event) => {
  if (dirty || saving) {
    event.preventDefault();
    event.returnValue = '';
  }
});
async function openDetail(sheet, row) {
  const requestId = ++openId;
  current = null;
  dirty = false;
  editing = false;
  $('#detail-title').textContent = 'กำลังโหลดรายละเอียด…';
  $('#detail-source').textContent = 'FULL ROW VIEW';
  $('#detail-content').replaceChildren(
    el('p', 'loading', 'กำลังอ่านข้อมูลล่าสุดจาก Google Sheets…'),
  );
  $('#detail-actions').replaceChildren();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
  try {
    const record = await api(`/api/record?sheet=${encodeURIComponent(sheet)}&row=${row}`);
    if (requestId !== openId) return;
    current = record;
    renderDetail();
  } catch (error) {
    if (requestId !== openId) return;
    $('#detail-title').textContent = 'โหลดรายละเอียดไม่ได้';
    $('#detail-content').replaceChildren(el('div', 'alert error', error.message));
  }
}
function renderDetail() {
  $('#detail-title').textContent = current.values[current.assetIndex] || 'รายละเอียดครุภัณฑ์';
  $('#detail-source').textContent = `${current.label} / แถว ${current.row}`;
  const content = $('#detail-content');
  content.replaceChildren();
  const context = el('div', 'detail-context');
  context.append(
    el(
      'span',
      current.editable ? 'badge editable' : 'badge readonly',
      current.editable ? 'แก้ไขได้' : 'ดูอย่างเดียว',
    ),
    el('span', 'column-count', `ข้อมูลครบ ${current.headers.length} คอลัมน์`),
  );
  content.append(context);
  if (editing) {
    content.append(el('p', 'edit-help', 'แก้ไขได้ทุกช่อง ตรวจสอบค่าทั้งหมดก่อนกดบันทึก'));
    if (current.dateIndex !== null) {
      const datebar = el('div', 'date-shortcut');
      const hint = el('div');
      hint.append(
        el('strong', '', 'ตรวจสอบครุภัณฑ์วันนี้'),
        el(
          'p',
          '',
          current.dateMode === 'inspection-note'
            ? 'อัปเดตวันที่ในหมายเหตุ โดยคงข้อความอื่นไว้'
            : `ช่อง: ${current.headers[current.dateIndex]}`,
        ),
      );
      datebar.append(
        hint,
        button('ตั้งวันที่เป็นวันนี้', 'button today-button', () => {
          const input = inputs[current.dateIndex];
          const nextValue =
            current.dateMode === 'inspection-note'
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
        el(
          'p',
          'alert warning',
          'ไม่พบคอลัมน์วันที่ตรวจสอบที่ชัดเจน ตั้งค่า IQI_DATE_HEADER ใน .env เพื่อเปิดใช้ปุ่มวันนี้',
        ),
      );
  }
  const fields = el('div', editing ? 'fields editing' : 'fields');
  inputs = [];
  baseline = [];
  current.headers.forEach((header, index) => {
    const field = el('div', 'field');
    const label = el(
      editing ? 'label' : 'div',
      'field-label',
      header || `คอลัมน์ ${index + 1} (ไม่มีชื่อ header)`,
    );
    const value = current.values[index];
    if (editing) {
      const rule = current.dropdowns?.[index];
      let input;
      if (rule?.strict) {
        input = document.createElement('select');
        const empty = el('option', '', '— ไม่ระบุ —');
        empty.value = '';
        input.append(empty);
        if (value && !rule.options.includes(value)) {
          const legacy = el(
            'option',
            '',
            `${displayFieldValue(header, value)} (ค่าปัจจุบันนอกตัวเลือก)`,
          );
          legacy.value = value;
          input.append(legacy);
        }
        rule.options.forEach((value) => {
          const option = el('option', '', displayFieldValue(header, value));
          option.value = value;
          input.append(option);
        });
      } else if (rule) {
        input = document.createElement('input');
        input.type = 'text';
        const list = el('datalist');
        list.id = `options-${index}`;
        rule.options.forEach((value) => {
          const option = el('option');
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
        dirty = inputs.some((input, i) => input.value !== baseline[i]);
        updateSaveState();
      };
      input.addEventListener('input', changed);
      input.addEventListener('change', changed);
      inputs.push(input);
      field.append(label, input);
      if (rule)
        field.append(
          el(
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
        el(
          'div',
          value ? 'field-value' : 'field-value blank',
          displayFieldValue(header, value) || '-',
        ),
      );
    fields.append(field);
  });
  content.append(fields);
  renderActions();
  $('#detail-scroll').scrollTop = 0;
}
function renderActions() {
  const actions = $('#detail-actions');
  actions.replaceChildren();
  if (!current.editable) {
    actions.append(
      el('span', 'action-note', 'อ่านข้อมูลจาก Google Sheets'),
      button('ปิดรายละเอียด', 'button secondary', closeDetail),
    );
    return;
  }
  if (!editing) {
    const edit = button(
      'แก้ไขข้อมูล',
      'button primary',
      () => {
        editing = true;
        renderDetail();
      },
      'pencil',
    );
    edit.disabled = saving;
    actions.append(el('span', 'action-note', 'IQI · แก้ไขได้ทุกคอลัมน์'), edit);
    return;
  }
  const left = el('div', 'save-status');
  left.id = 'save-status';
  actions.append(
    left,
    button('ยกเลิก', 'button secondary', () => {
      if (dirty && !confirm('ยกเลิกข้อมูลที่แก้ไขทั้งหมด?')) return;
      dirty = false;
      editing = false;
      renderDetail();
    }),
  );
  const saveButton = button('บันทึก', 'button primary', save);
  saveButton.id = 'save-button';
  actions.append(saveButton);
  updateSaveState();
}
function updateSaveState() {
  if (!editing) return;
  $('#save-status').textContent = dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง';
  $('#save-button').disabled = !dirty || saving;
}
async function save() {
  if (saving || !dirty) return;
  saving = true;
  $('#save-button').disabled = true;
  $('#save-button').textContent = 'กำลังบันทึก…';
  $('#close-detail').disabled = true;
  $('#detail-actions')
    .querySelectorAll('button')
    .forEach((b) => (b.disabled = true));
  inputs.forEach((input) => (input.disabled = true));
  $('#detail-content')
    .querySelectorAll('button')
    .forEach((b) => (b.disabled = true));
  $('#detail-save-error')?.remove();
  try {
    const values = editedValues(
      current.values,
      baseline,
      inputs.map((input) => input.value),
    );
    current = await api(`/api/iqi/${current.row}`, {
      method: 'PUT',
      body: JSON.stringify({ sheet: current.sheet, revision: current.revision, values }),
    });
    dirty = false;
    editing = false;
    renderDetail();
    toast('บันทึกสำเร็จ · อ่านข้อมูลล่าสุดจาก Google Sheets แล้ว');
    if (lastQuery || $('#pending-only').checked) await search(lastQuery);
  } catch (error) {
    const alert = el('div', 'alert error', error.message);
    alert.id = 'detail-save-error';
    alert.setAttribute('role', 'alert');
    $('#detail-content').prepend(alert);
    $('#detail-scroll').scrollTop = 0;
  } finally {
    saving = false;
    $('#close-detail').disabled = false;
    inputs.forEach((input) => (input.disabled = false));
    $('#detail-content')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = false));
    renderActions();
  }
}
authDialog.addEventListener('cancel', (event) => event.preventDefault());
authDialog.addEventListener('close', () => {
  if (!authenticated && !authDialog.open) authDialog.showModal();
});
$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#auth-error').hidden = true;
  $('#auth-submit').disabled = true;
  $('#auth-submit').textContent = 'กำลังตรวจสอบ…';
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: $('#auth-password').value }),
    });
    authenticated = true;
    $('#auth-password').value = '';
    authDialog.close();
    $('#logout-button').hidden = false;
    if (await connect()) {
      const query = $('#query').value.trim();
      if (query || $('#pending-only').checked) await search(query);
    }
  } catch (error) {
    $('#auth-error').textContent = error.message;
    $('#auth-error').hidden = false;
    $('#auth-password').select();
  } finally {
    $('#auth-submit').disabled = false;
    $('#auth-submit').textContent = 'เข้าใช้งาน';
  }
});
$('#logout-button').addEventListener('click', async () => {
  if (dirty && !confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการล็อกออกหรือไม่?')) return;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    dirty = false;
    current = null;
    editing = false;
    inputs = [];
    baseline = [];
    if (dialog.open) dialog.close();
    document.body.classList.remove('modal-open');
    $('#detail-content').replaceChildren();
    $('#detail-actions').replaceChildren();
    $('#query').value = '';
    $('#pending-only').checked = false;
    onQueryInput({ isComposing: false });
    showLogin();
  } catch (error) {
    toast(error.message);
  }
});
async function initializeAuth() {
  try {
    const { maxUploadBytes } = await api('/api/upload-config');
    setUploadLimit(maxUploadBytes);
    const session = await api('/api/auth/session');
    csrf = session.csrf;
    if (session.authenticated) {
      authenticated = true;
      $('#logout-button').hidden = false;
      await connect();
    } else showLogin();
  } catch (error) {
    showLogin();
    $('#auth-error').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาโหลดหน้าเว็บใหม่';
    $('#auth-error').hidden = false;
  }
}
initializeAuth();
