import { recordPhotos, MAX_PHOTOS, PHOTO_SLOTS, LEGACY_PHOTO_HEADERS } from './photoSlots.js';
import { copyText } from './clipboard.js';
import { icon } from './icons.js';
import { resizeForUpload } from './photos.js';
import { saveStatusDrafts } from './dashboardBulk.js';
const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const action = (text, cls, fn) => {
  const b = node('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
};
const tone = (s) =>
  ({
    ดี: 'good',
    ชำรุด: 'damaged',
    หาไม่เจอ: 'lost',
    ยังไม่ตรวจ: 'todo',
    อุปกรอื่นๆ: 'other',
    กล้องวงจรปิด: 'cctv',
    ตรงกัน: 'good',
    ข้อมูลไม่ตรง: 'damaged',
  })[s] || 'todo';
export function initializeDashboard({ api, isAuthenticated, onLogin }) {
  const panel = document.querySelector('#dashboard-panel'),
    searchTab = document.querySelector('#search-tab'),
    dashboardTab = document.querySelector('#dashboard-tab');
  let data = null,
    version = 0,
    busy = false,
    inspection = '',
    comparison = '',
    query = '',
    active = false;
  const drafts = new Map();
  let saving = false,
    feedback = '';
  const searchSections = () =>
    document.querySelectorAll('main>.intro,main>.search-card,main>#results,main>#page-error');
  const modal = node('dialog', 'dashboard-dialog');
  modal.setAttribute('aria-label', 'รายละเอียดรายการ Dashboard');
  document.body.append(modal);
  let clearPhotoPreviews = () => {};
  modal.addEventListener('close', () => clearPhotoPreviews());
  function details(record) {
    clearPhotoPreviews();
    modal.replaceChildren();
    const head = node('div', 'dash-detail-head');
    head.append(
      node('h2', '', record.asset),
      action('ปิด', 'button secondary', () => modal.close()),
    );
    modal.append(head, photoEditor(record));
    const fields = node('div', 'fields');
    let teamInput, notesInput;
    const message = node('p', 'dash-hint');
    message.setAttribute('role', 'status');
    const changed = () =>
      (teamInput && teamInput.value !== record.team) ||
      (notesInput && notesInput.value !== record.editableNotes);
    const saveDetails = action('บันทึกทีมและหมายเหตุ', 'button primary', async () => {
      if (saving || !changed()) return;
      const body = { revision: record.revision };
      if (teamInput && teamInput.value !== record.team) body.team = teamInput.value;
      if (notesInput && notesInput.value !== record.editableNotes) body.notes = notesInput.value;
      saving = true;
      saveDetails.disabled = true;
      if (teamInput) teamInput.disabled = true;
      if (notesInput) notesInput.disabled = true;
      message.textContent = 'กำลังบันทึก…';
      const request = version;
      try {
        const result = await api(`/api/dashboard/${record.row}/details`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        if (request !== version) return;
        data.records = data.records.map((r) => (r.row === record.row ? result.record : r));
        feedback = `บันทึกทีมและหมายเหตุของ ${record.asset} แล้ว`;
        saving = false;
        render();
        details(result.record);
      } catch (error) {
        if (request === version) message.textContent = error.message;
      } finally {
        saving = false;
        if (teamInput) teamInput.disabled = false;
        if (notesInput) notesInput.disabled = false;
        saveDetails.disabled = !changed();
      }
    });
    saveDetails.disabled = true;
    data.headers.forEach((h, i) => {
      if ([...PHOTO_SLOTS, ...LEGACY_PHOTO_HEADERS, 'รูปครุภัณฑ์'].includes(h)) return;
      const field = node('div', 'field');
      field.append(node('div', 'field-label', h));
      if (h === 'ทีม') {
        teamInput = node('select', 'dash-detail-input');
        teamInput.setAttribute('aria-label', 'ทีม');
        for (const team of ['', ...data.teams]) {
          const option = node('option', '', team || 'ไม่ระบุทีม');
          option.value = team;
          teamInput.append(option);
        }
        teamInput.value = record.team;
        teamInput.addEventListener('change', () => {
          saveDetails.disabled = saving || !changed();
        });
        field.append(teamInput);
      } else if (h === 'หมายเหตุ') {
        notesInput = node('textarea', 'dash-detail-input');
        notesInput.setAttribute('aria-label', 'หมายเหตุ');
        notesInput.rows = 3;
        notesInput.maxLength = 5000;
        notesInput.value = record.editableNotes;
        notesInput.addEventListener('input', () => {
          saveDetails.disabled = saving || !changed();
        });
        field.append(notesInput);
      } else field.append(node('div', 'field-value', record.values[i] || '—'));
      fields.append(field);
    });
    modal.append(fields, saveDetails, message);
    if (!modal.open) modal.showModal();
  }
  function photoEditor(record) {
    const section = node('section', 'dash-photo-section');
    const photos = recordPhotos(data.headers, record.values);
    section.append(node('h3', '', 'รูปครุภัณฑ์ · ' + photos.length + '/' + MAX_PHOTOS));
    const gallery = node('div', 'dash-photo-gallery');
    for (const [index, photo] of photos.entries()) {
      const link = node('a');
      link.href = photo.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const img = node('img');
      img.src = '/api/dashboard/' + record.row + '/photos/' + photo.id;
      img.alt = 'รูป' + (index + 1) + ' ' + record.asset;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.hidden = true;
        link.textContent = 'เปิดรูป' + (index + 1) + 'ใน Drive';
      });
      link.append(img);
      gallery.append(link);
    }
    if (photos.length) section.append(gallery);
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      section.append(node('p', 'dash-hint', 'ครบ 3 รูปแล้ว'));
      return section;
    }
    const controls = node('div', 'dash-photo-controls');
    const input = node('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
    input.setAttribute('aria-label', 'เลือกรูปครุภัณฑ์ ' + record.asset);
    const previews = node('div', 'dash-photo-gallery');
    let previewUrls = [];
    clearPhotoPreviews = () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls = [];
    };
    const message = node('p', 'dash-hint');
    message.setAttribute('role', 'status');
    message.textContent = 'เลือกพร้อมกันได้อีก ' + remaining + ' รูป · ไม่เกิน 25 MB/รูป';
    const upload = action('อัปโหลด', 'button primary', async () => {
      const files = Array.from(input.files || []);
      if (saving || !files.length) return;
      if (files.length > remaining) {
        message.textContent = 'เลือกได้อีก ' + remaining + ' รูปเท่านั้น';
        return;
      }
      if (files.some((f) => f.size > 25 * 1024 * 1024)) {
        message.textContent = 'รูปต้องมีขนาดไม่เกิน 25 MB';
        return;
      }
      saving = true;
      upload.disabled = true;
      input.disabled = true;
      const request = version;
      let revision = record.revision,
        completed = 0,
        errorMessage = '';
      try {
        for (const file of files) {
          message.textContent = 'กำลังอัปโหลด ' + (completed + 1) + '/' + files.length + '…';
          const blob = await resizeForUpload(file);
          if (request !== version) break;
          const result = await api('/api/dashboard/' + record.row + '/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'X-Record-Revision': revision },
            body: blob,
          });
          completed++;
          revision = result.revision;
        }
      } catch (error) {
        errorMessage = error.message;
      } finally {
        saving = false;
        input.disabled = false;
        upload.disabled = false;
      }
      if (request !== version) return;
      const summary =
        (completed ? 'เพิ่มแล้ว ' + completed + '/' + files.length + ' รูป' : '') +
        (errorMessage ? ' · ' + errorMessage : '');
      if (!completed) {
        message.textContent = errorMessage;
        return;
      }
      try {
        data = await api('/api/dashboard');
        if (request !== version) return;
        feedback = summary;
        render();
        const fresh = data.records.find((r) => r.row === record.row);
        if (fresh) {
          details(fresh);
          modal.querySelector('[role="status"]')?.append(node('span', '', ' · ' + summary));
        }
      } catch (error) {
        message.textContent = summary + ' · โหลดข้อมูลล่าสุดไม่สำเร็จ: ' + error.message;
      }
    });
    upload.disabled = true;
    input.addEventListener('change', () => {
      clearPhotoPreviews();
      previews.replaceChildren();
      const files = Array.from(input.files || []);
      upload.disabled =
        !files.length || files.length > remaining || files.some((f) => f.size > 25 * 1024 * 1024);
      message.textContent =
        files.length > remaining
          ? 'เลือกได้อีก ' + remaining + ' รูปเท่านั้น'
          : files.some((f) => f.size > 25 * 1024 * 1024)
            ? 'รูปต้องมีขนาดไม่เกิน 25 MB'
            : 'เลือกแล้ว ' + files.length + ' รูป · รวมได้สูงสุด 3 รูป';
      for (const file of files.slice(0, remaining)) {
        if (/hei[cf]/i.test(file.name)) continue;
        const img = node('img');
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        img.src = url;
        img.alt = file.name;
        previews.append(img);
      }
    });
    controls.append(input, upload);
    section.append(controls, previews, message);
    return section;
  }
  function show(which) {
    active = which === 'dashboard';
    panel.hidden = !active;
    searchSections().forEach((n) => {
      if (n.id !== 'page-error' || active) n.hidden = active;
    });
    searchTab.classList.toggle('active', !active);
    dashboardTab.classList.toggle('active', active);
    searchTab.setAttribute('aria-pressed', String(!active));
    dashboardTab.setAttribute('aria-pressed', String(active));
    if (active && !data) load();
  }
  async function load() {
    if (busy) return;
    if (!isAuthenticated()) {
      onLogin();
      return;
    }
    busy = true;
    const request = ++version;
    panel.replaceChildren(node('p', 'loading', 'กำลังโหลดข้อมูล Appscriptdata…'));
    try {
      const result = await api('/api/dashboard');
      if (request !== version) return;
      data = result;
      render();
    } catch (e) {
      if (request !== version) return;
      panel.replaceChildren(
        node('div', 'alert error', e.message),
        action('ลองโหลดอีกครั้ง', 'button primary', load),
      );
    } finally {
      if (request === version) busy = false;
    }
  }
  function stat(label, count, kind, selected, fn) {
    const b = action('', 'dash-stat ' + tone(label) + (selected ? ' selected' : ''), fn);
    b.setAttribute('aria-pressed', String(selected));
    b.append(
      node('span', 'dash-stat-label', label),
      node('strong', '', String(count)),
      node('span', 'dash-stat-caption', kind),
    );
    return b;
  }
  function copyValue(value, label) {
    const wrap = node('span', 'dash-copy-value');
    wrap.append(node('span', '', value || '—'));
    if (value) {
      const b = action('', 'copy-code', async () => {
        try {
          await copyText(value);
          b.replaceChildren(icon('check'));
          b.title = 'คัดลอกแล้ว';
          b.setAttribute('aria-label', `คัดลอก${label}แล้ว ${value}`);
          setTimeout(() => {
            b.replaceChildren(icon('copy'));
            b.title = `คัดลอก${label}`;
            b.setAttribute('aria-label', `คัดลอก${label} ${value}`);
          }, 1600);
        } catch {
          b.title = 'คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอก';
          b.setAttribute('aria-label', b.title);
        }
      });
      b.append(icon('copy'));
      b.title = `คัดลอก${label}`;
      b.setAttribute('aria-label', `คัดลอก${label} ${value}`);
      wrap.append(b);
    }
    return wrap;
  }
  function statusEditor(record) {
    const wrap = node('div', 'dash-status-editor'),
      controls = node('div', 'dash-status-controls'),
      select = node('select', 'dash-status-select ' + tone(record.inspection));
    select.setAttribute('aria-label', `สถานะ ${record.asset} ${record.serial}`);
    if (record.inspection === 'ไม่ระบุ') {
      const empty = node('option', '', 'เลือกสถานะ');
      empty.value = '';
      select.append(empty);
    }
    for (const status of ['ดี', 'ชำรุด', 'หาไม่เจอ', 'ยังไม่ตรวจ', 'อุปกรอื่นๆ', 'กล้องวงจรปิด']) {
      const option = node('option', '', status);
      option.value = status;
      select.append(option);
    }
    select.value = drafts.get(record.row)?.status || record.inspection;
    const message = node('div', 'dash-save-message');
    message.setAttribute('role', 'status');
    const save = action('บันทึก', 'button dash-save', async () => {
      if (saving || !drafts.has(record.row)) return;
      const draft = drafts.get(record.row),
        request = version;
      saving = true;
      panel.querySelectorAll('button,select,input').forEach((n) => (n.disabled = true));
      message.textContent = 'กำลังบันทึก…';
      try {
        const result = await api(`/api/dashboard/${record.row}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: draft.status, revision: draft.revision }),
        });
        if (request !== version) return;
        drafts.delete(record.row);
        feedback = result.unchanged
          ? 'สถานะเหมือนเดิม วันที่ไม่เปลี่ยน'
          : `บันทึก ${record.asset} เป็น ${result.record.inspection} แล้ว · ${result.record.updatedAt}`;
        data = await api('/api/dashboard');
        if (request !== version) return;
        saving = false;
        render();
      } catch (error) {
        if (request !== version) return;
        message.textContent = error.message;
      } finally {
        saving = false;
        if (request === version) {
          panel.querySelectorAll('button,select,input').forEach((n) => (n.disabled = false));
          panel
            .querySelectorAll('.dash-save')
            .forEach((n) => (n.disabled = n.dataset.changed !== 'true'));
          updateBulkButton();
        }
      }
    });
    const update = () => {
      if (select.value === record.inspection) drafts.delete(record.row);
      else drafts.set(record.row, { status: select.value, revision: record.revision });
      save.dataset.changed = String(drafts.has(record.row));
      save.disabled = saving || !drafts.has(record.row);
      select.className = 'dash-status-select ' + tone(select.value);
      updateBulkButton();
    };
    select.addEventListener('change', update);
    save.dataset.changed = String(drafts.has(record.row));
    save.disabled = saving || !drafts.has(record.row);
    select.disabled = saving;
    controls.append(select, save);
    wrap.append(
      controls,
      node(
        'div',
        'dash-updated-at',
        record.updatedAt ? `อัปเดตล่าสุด ${record.updatedAt}` : 'ยังไม่มีวันที่อัปเดตจากเว็บ',
      ),
      message,
    );
    return wrap;
  }
  function updateBulkButton() {
    const button = panel.querySelector('#dash-save-all');
    if (!button) return;
    button.disabled = saving || drafts.size === 0;
    button.textContent = drafts.size ? `บันทึกทั้งหมด (${drafts.size})` : 'บันทึกทั้งหมด';
    panel.querySelector('#dash-draft-count').textContent = drafts.size
      ? `มี ${drafts.size} รายการที่แก้ไขยังไม่บันทึก · รวมรายการที่ซ่อนด้วยตัวกรอง`
      : 'ไม่มีรายการที่แก้ไขค้างไว้';
  }
  async function saveAllStatuses() {
    if (saving || !drafts.size) return;
    const request = version;
    saving = true;
    panel.querySelectorAll('button,select,input').forEach((n) => (n.disabled = true));
    const count = panel.querySelector('#dash-draft-count');
    try {
      const result = await saveStatusDrafts(
        drafts,
        (row, draft) =>
          api(`/api/dashboard/${row}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: draft.status, revision: draft.revision }),
          }),
        {
          isCurrent: () => request === version,
          onProgress: (done, total) => {
            count.textContent = `กำลังบันทึก ${done}/${total}…`;
          },
        },
      );
      if (request !== version) return;
      for (const saved of result.saved) {
        data.records = data.records.map((r) => (r.row === saved.row ? saved.result.record : r));
      }
      feedback = `บันทึกสำเร็จ ${result.saved.length} รายการ`;
      if (result.failed.length)
        feedback +=
          ` · ไม่สำเร็จ ${result.failed.length} รายการ (เก็บค่าที่เลือกไว้): ` +
          result.failed
            .map(
              (f) =>
                `${data.records.find((r) => r.row === f.row)?.asset || `แถว ${f.row}`}: ${f.message}`,
            )
            .join(' · ');
      try {
        const fresh = await api('/api/dashboard');
        if (request === version) data = fresh;
      } catch (error) {
        feedback += ` · โหลดข้อมูลล่าสุดไม่สำเร็จ: ${error.message}`;
      }
    } finally {
      saving = false;
      if (request === version) render();
    }
  }
  function renderList() {
    const target = panel.querySelector('#dash-list');
    target.replaceChildren();
    const normalized = query.trim().toLocaleLowerCase();
    const records = data.records.filter(
      (r) =>
        (!inspection || r.inspection === inspection) &&
        (!comparison || r.comparison === comparison) &&
        (!normalized || r.values.some((v) => v.toLocaleLowerCase().includes(normalized))),
    );
    panel.querySelector('#dash-count').textContent =
      `แสดง ${records.length.toLocaleString('th-TH')} จาก ${data.total.toLocaleString('th-TH')} รายการ`;
    if (!records.length) {
      target.append(node('p', 'dash-empty', 'ไม่พบรายการตามตัวกรองที่เลือก'));
      return;
    }
    const table = node('table', 'dash-table');
    const thead = node('thead'),
      head = node('tr');
    [
      'เลขครุภัณฑ์ / อุปกรณ์',
      'S/N',
      'ผลตรวจ Apps Script',
      'การเทียบกับชีต',
      'ผู้ถือครอง / ทีม',
      'รายละเอียด',
    ].forEach((x) => head.append(node('th', '', x)));
    thead.append(head);
    table.append(thead);
    const body = node('tbody');
    records.forEach((r) => {
      const tr = node(
        'tr',
        'dash-row ' + (r.inspection === 'ยังไม่ตรวจ' ? '' : tone(r.inspection)),
      );
      const identity = node('td');
      const asset = copyValue(r.asset, 'เลขครุภัณฑ์');
      asset.classList.add('dash-asset');
      identity.append(asset, node('span', 'dash-item-name', r.name || 'ไม่ระบุชื่ออุปกรณ์'));
      const serial = node('td', 'dash-serial');
      serial.append(copyValue(r.serial, 'S/N'));
      const status = node('td');
      status.append(statusEditor(r));
      const match = node('td');
      match.append(node('span', 'dash-badge ' + tone(r.comparison), r.comparison));
      const owner = node('td');
      owner.append(node('span', '', r.owner || '—'), node('span', 'dash-item-name', r.team || ''));
      const open = node('td');
      open.append(action('ดูข้อมูล', 'button dash-open', () => details(r)));
      tr.append(identity, serial, status, match, owner, open);
      body.append(tr);
    });
    table.append(body);
    target.append(table);
  }
  function render() {
    panel.replaceChildren();
    const head = node('div', 'dash-heading');
    const title = node('div');
    title.append(
      node('div', 'eyebrow', 'IQI · APPSCRIPTDATA'),
      node('h1', '', 'Dashboard ครุภัณฑ์'),
      node('p', '', 'ผลตรวจจาก Apps Script และการเทียบข้อมูลกับ Google Sheets'),
    );
    head.append(
      title,
      action('โหลดข้อมูลล่าสุด', 'button secondary', () => {
        drafts.clear();
        feedback = '';
        load();
      }),
    );
    panel.append(head);
    const bulk = node('div', 'dash-bulk-bar');
    const bulkMessage = node('span');
    bulkMessage.id = 'dash-draft-count';
    bulkMessage.setAttribute('role', 'status');
    const bulkSave = action('บันทึกทั้งหมด', 'button primary', saveAllStatuses);
    bulkSave.id = 'dash-save-all';
    bulk.append(bulkMessage, bulkSave);
    panel.append(bulk);
    updateBulkButton();
    if (feedback) {
      const notice = node('p', 'dash-save-success', feedback);
      notice.setAttribute('role', 'status');
      panel.append(notice);
    }
    const progress = node('section', 'dash-progress');
    const progressHead = node('div', 'dash-progress-head');
    progressHead.append(
      node('h2', '', 'ความคืบหน้าการตรวจ'),
      node('strong', '', `${data.percent.toLocaleString('th-TH')}%`),
    );
    const bar = node('progress');
    bar.max = data.total || 1;
    bar.value = data.completed;
    bar.setAttribute('aria-label', 'ความคืบหน้าการตรวจครุภัณฑ์');
    progress.append(
      progressHead,
      node(
        'p',
        'dash-progress-text',
        `ตรวจแล้ว ${data.completed.toLocaleString('th-TH')} / ${data.total.toLocaleString('th-TH')} รายการ`,
      ),
      bar,
      node(
        'p',
        'dash-hint',
        'นับตรวจแล้วจาก ดี + ชำรุด + หาไม่เจอ + อุปกรอื่นๆ + กล้องวงจรปิด ตามผลตรวจ Apps Script',
      ),
    );
    panel.append(progress);
    panel.append(node('h2', 'dash-section-title', 'ผลตรวจ Apps Script'));
    const stats = node('div', 'dash-stats');
    for (const s of [
      'ดี',
      'ชำรุด',
      'หาไม่เจอ',
      'ยังไม่ตรวจ',
      'อุปกรอื่นๆ',
      'กล้องวงจรปิด',
      ...(data.inspection['ไม่ระบุ'] ? ['ไม่ระบุ'] : []),
    ])
      stats.append(
        stat(s, data.inspection[s] || 0, 'รายการ', inspection === s, () => {
          inspection = inspection === s ? '' : s;
          render();
        }),
      );
    panel.append(stats);
    panel.append(node('h2', 'dash-section-title', 'ข้อมูล Apps Script เทียบกับ Google Sheets'));
    const matches = node('div', 'dash-matches');
    Object.entries(data.comparison).forEach(([s, count]) =>
      matches.append(
        stat(s, count, 'ผลการเทียบข้อมูล', comparison === s, () => {
          comparison = comparison === s ? '' : s;
          render();
        }),
      ),
    );
    panel.append(
      matches,
      node(
        'p',
        'dash-hint',
        '“หาไม่เจอ” ในการเทียบข้อมูล หมายถึงไม่พบข้อมูลในชีตต้นฉบับ เป็นคนละส่วนกับผลตรวจหาอุปกรณ์ไม่เจอ',
      ),
    );
    const tools = node('div', 'dash-tools');
    const input = node('input', 'dash-query');
    input.type = 'search';
    input.placeholder = 'ค้นหาเลขครุภัณฑ์ S/N อุปกรณ์ ผู้ถือครอง หรือหมายเหตุ';
    input.setAttribute('aria-label', 'ค้นหารายการ Dashboard');
    input.value = query;
    input.addEventListener('input', () => {
      query = input.value;
      renderList();
    });
    tools.append(
      input,
      action('ล้างตัวกรอง', 'button secondary', () => {
        inspection = '';
        comparison = '';
        query = '';
        render();
      }),
    );
    panel.append(tools);
    const listHead = node('div', 'dash-list-head');
    const count = node('strong');
    count.id = 'dash-count';
    listHead.append(
      count,
      node(
        'span',
        'dash-hint',
        [inspection, comparison].filter(Boolean).join(' · ') || 'ทุกรายการ',
      ),
    );
    panel.append(listHead);
    const list = node('div', 'dash-list');
    list.id = 'dash-list';
    panel.append(list);
    const time = new Date(data.loadedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    panel.append(
      node(
        'p',
        'dash-updated',
        `อ่านจากแท็บ Appscriptdata เมื่อ ${time} · แก้สถานะผ่านหน้านี้จะบันทึกลง Appscriptdata เท่านั้น`,
      ),
    );
    renderList();
  }
  searchTab.addEventListener('click', () => show('search'));
  dashboardTab.addEventListener('click', () => show('dashboard'));
  return {
    clear() {
      version++;
      busy = false;
      saving = false;
      drafts.clear();
      feedback = '';
      data = null;
      inspection = '';
      comparison = '';
      query = '';
      panel.replaceChildren();
      modal.close();
      modal.replaceChildren();
      show('search');
    },
  };
}
