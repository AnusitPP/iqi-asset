import { copyText } from './clipboard.js';
import { icon } from './icons.js';
import { resizeForUpload } from './photos.js';
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
  function details(record) {
    modal.replaceChildren();
    const head = node('div', 'dash-detail-head');
    head.append(
      node('h2', '', record.asset),
      action('ปิด', 'button secondary', () => modal.close()),
    );
    modal.append(head, photoEditor(record));
    const fields = node('div', 'fields');
    data.headers.forEach((h, i) => {
      const field = node('div', 'field');
      field.append(
        node('div', 'field-label', h),
        node('div', 'field-value', record.values[i] || '—'),
      );
      fields.append(field);
    });
    modal.append(fields);
    if (!modal.open) modal.showModal();
  }
  function photoEditor(record) {
    const section = node('section', 'dash-photo-section');
    section.append(node('h3', '', 'รูปครุภัณฑ์'));
    const urls = (record.values[data.headers.indexOf('ลิงก์รูปครุภัณฑ์')] || '').split('\n');
    const gallery = node('div', 'dash-photo-gallery');
    for (const url of urls) {
      const id = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/)?.[1];
      if (!id) continue;
      const link = node('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const img = node('img');
      img.src = `/api/dashboard/${record.row}/photos/${id}`;
      img.alt = `รูป ${record.asset}`;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.hidden = true;
        link.textContent = 'เปิดรูปใน Drive';
      });
      link.append(img);
      gallery.append(link);
    }
    section.append(gallery);
    const input = node('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
    input.setAttribute('aria-label', `เลือกรูป ${record.asset}`);
    const preview = node('img', 'dash-photo-preview');
    preview.hidden = true;
    let previewUrl = '';
    const message = node('p', 'dash-hint');
    message.setAttribute('role', 'status');
    message.textContent =
      'JPEG / PNG / WebP / HEIC · สูงสุด 25 MB · ย่อด้านยาวเหลือไม่เกิน 1,600 พิกเซล';
    const upload = action('อัปโหลดรูป', 'button primary', async () => {
      if (saving || !input.files?.[0]) return;
      saving = true;
      upload.disabled = true;
      input.disabled = true;
      const request = version;
      try {
        message.textContent = 'กำลังย่อรูปและอัปโหลด…';
        const blob = await resizeForUpload(input.files[0]);
        const result = await api(`/api/dashboard/${record.row}/photos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Record-Revision': record.revision,
          },
          body: blob,
        });
        if (request !== version) return;
        data = await api('/api/dashboard');
        if (request !== version) return;
        feedback = `เพิ่มรูป ${record.asset} แล้ว · ${result.at}`;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        render();
        details(data.records.find((r) => r.row === record.row));
      } catch (error) {
        if (request === version) message.textContent = error.message;
      } finally {
        saving = false;
        input.disabled = false;
        upload.disabled = !input.files?.length;
      }
    });
    upload.disabled = true;
    input.addEventListener('change', () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      preview.hidden = true;
      upload.disabled = !input.files?.length;
      if (input.files?.[0] && !/hei[cf]/i.test(input.files[0].name)) {
        previewUrl = URL.createObjectURL(input.files[0]);
        preview.src = previewUrl;
        preview.hidden = false;
      }
    });
    preview.addEventListener('error', () => (preview.hidden = true));
    modal.addEventListener(
      'close',
      () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      },
      { once: true },
    );
    section.append(input, preview, upload, message);
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
    for (const status of ['ดี', 'ชำรุด', 'หาไม่เจอ', 'ยังไม่ตรวจ']) {
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
        }
      }
    });
    const update = () => {
      if (select.value === record.inspection) drafts.delete(record.row);
      else drafts.set(record.row, { status: select.value, revision: record.revision });
      save.dataset.changed = String(drafts.has(record.row));
      save.disabled = saving || !drafts.has(record.row);
      select.className = 'dash-status-select ' + tone(select.value);
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
      node('p', 'dash-hint', 'นับตรวจแล้วจาก ดี + ชำรุด + หาไม่เจอ ตามผลตรวจ Apps Script เท่านั้น'),
    );
    panel.append(progress);
    panel.append(node('h2', 'dash-section-title', 'ผลตรวจ Apps Script'));
    const stats = node('div', 'dash-stats');
    for (const s of [
      'ดี',
      'ชำรุด',
      'หาไม่เจอ',
      'ยังไม่ตรวจ',
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
