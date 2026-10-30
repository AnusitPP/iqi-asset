import { can } from '../auth/permissions.js';
import { UI_MESSAGES } from '/shared/core/constants/messages.js';
import { initializeWorkspaceTabs } from '../../core/navigation/tabs.js';
import { initializeDashboardDetails } from './details.js';
import { createElement, createButton as createActionButton } from '../../core/dom/elements.js';
import { formatBangkokDisplayTimestamp } from '/shared/core/extensions/dates.js';
import { copyText } from '../../core/browser/clipboard.js';
import { icon } from '../../core/components/icons.js';
import { saveStatusDrafts } from './dashboardBulk.js';
const statusTone = (status) =>
  ({
    ดี: 'good',
    ชำรุด: 'damaged',
    หาไม่เจอ: 'lost',
    ยังไม่ตรวจ: 'todo',
    อุปกรอื่นๆ: 'other',
    กล้องวงจรปิด: 'cctv',
    ตรงกัน: 'good',
    ข้อมูลไม่ตรง: 'damaged',
  })[status] || 'todo';
export function initializeDashboard({ api, isAuthenticated, onLogin }) {
  const panel = document.querySelector('#dashboard-panel');
  const loadingSkeleton = panel.querySelector('.dash-skeleton').cloneNode(true);
  let dashboardData = null,
    loadGeneration = 0,
    isLoading = false,
    inspectionFilter = '',
    comparisonFilter = '',
    teamFilter = '',
    searchQuery = '',
    isDashboardActive = false;
  const statusDrafts = new Map();
  let filtersOpen = false;
  let isSaving = false,
    saveFeedback = '';
  const detailsDialog = initializeDashboardDetails({
    api,
    renderDashboard: renderDashboard,
    state: {
      get data() {
        return dashboardData;
      },
      set data(value) {
        dashboardData = value;
      },
      get version() {
        return loadGeneration;
      },
      get saving() {
        return isSaving;
      },
      set saving(value) {
        isSaving = value;
      },
      set feedback(value) {
        saveFeedback = value;
      },
    },
  });
  const openRecordDetails = detailsDialog.open;
  const navigation = initializeWorkspaceTabs((page) => {
    isDashboardActive = page === 'dashboard';
    if (isDashboardActive && !dashboardData && isAuthenticated()) loadDashboard();
  });
  const show = navigation.show;
  async function loadDashboard() {
    if (isLoading) return;
    if (!isAuthenticated()) {
      onLogin();
      return;
    }
    isLoading = true;
    const request = ++loadGeneration;
    panel.setAttribute('aria-busy', 'true');
    panel.replaceChildren(loadingSkeleton.cloneNode(true));
    try {
      const result = await api('/api/dashboard');
      if (request !== loadGeneration) return;
      dashboardData = result;
      renderDashboard();
    } catch (e) {
      if (request !== loadGeneration) return;
      panel.replaceChildren(
        createElement('div', 'alert error', e.message),
        createActionButton(UI_MESSAGES.RETRY_LOAD, 'button primary', loadDashboard),
      );
    } finally {
      if (request === loadGeneration) {
        isLoading = false;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  }
  function createStatusFilter(label, count, _kind, selected, onClick) {
    const b = createActionButton(
      '',
      'dash-stat ' + statusTone(label) + (selected ? ' selected' : ''),
      onClick,
    );
    b.setAttribute('aria-pressed', String(selected));
    b.append(
      createElement('span', 'dash-stat-label', label),
      createElement('strong', '', String(count)),
    );
    return b;
  }
  function renderCopyableValue(value, label) {
    const wrap = createElement('span', 'dash-copy-value');
    wrap.append(createElement('span', '', value || '—'));
    if (value) {
      const b = createActionButton('', 'copy-code', async () => {
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
  function renderStatusEditor(record) {
    const wrap = createElement('div', 'dash-status-editor'),
      controls = createElement('div', 'dash-status-controls'),
      select = createElement('select', 'dash-status-select ' + statusTone(record.inspection));
    select.setAttribute('aria-label', `สถานะ ${record.asset} ${record.serial}`);
    if (record.inspection === 'ไม่ระบุ') {
      const empty = createElement('option', '', 'เลือกสถานะ');
      empty.value = '';
      select.append(empty);
    }
    for (const status of ['ดี', 'ชำรุด', 'หาไม่เจอ', 'ยังไม่ตรวจ', 'อุปกรอื่นๆ', 'กล้องวงจรปิด']) {
      const option = createElement('option', '', status);
      option.value = status;
      select.append(option);
    }
    select.value = statusDrafts.get(record.row)?.status || record.inspection;
    const message = createElement('div', 'dash-save-message');
    message.setAttribute('role', 'status');
    const save = createActionButton('บันทึก', 'button dash-save', async () => {
      if (isSaving || !statusDrafts.has(record.row)) return;
      const draft = statusDrafts.get(record.row),
        request = loadGeneration;
      isSaving = true;
      panel.querySelectorAll('button,select,input').forEach((element) => (element.disabled = true));
      message.textContent = UI_MESSAGES.SAVING;
      try {
        const result = await api(`/api/dashboard/${record.row}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: draft.status, revision: draft.revision }),
        });
        if (request !== loadGeneration) return;
        statusDrafts.delete(record.row);
        saveFeedback = result.unchanged
          ? 'สถานะเหมือนเดิม วันที่ไม่เปลี่ยน'
          : `บันทึก ${record.asset} เป็น ${result.record.inspection} แล้ว · ${result.record.updatedAt}`;
        dashboardData = await api('/api/dashboard');
        if (request !== loadGeneration) return;
        isSaving = false;
        renderDashboard();
      } catch (error) {
        if (request !== loadGeneration) return;
        message.textContent = error.message;
      } finally {
        isSaving = false;
        if (request === loadGeneration) {
          panel
            .querySelectorAll('button,select,input')
            .forEach((element) => (element.disabled = false));
          panel
            .querySelectorAll('.dash-save')
            .forEach((element) => (element.disabled = element.dataset.changed !== 'true'));
          updateBulkButton();
        }
      }
    });
    const update = () => {
      if (select.value === record.inspection) statusDrafts.delete(record.row);
      else statusDrafts.set(record.row, { status: select.value, revision: record.revision });
      save.dataset.changed = String(statusDrafts.has(record.row));
      save.disabled = isSaving || !statusDrafts.has(record.row);
      select.className = 'dash-status-select ' + statusTone(select.value);
      updateBulkButton();
    };
    select.addEventListener('change', update);
    save.dataset.changed = String(statusDrafts.has(record.row));
    save.disabled = isSaving || !statusDrafts.has(record.row);
    select.disabled = isSaving;
    controls.append(select, save);
    wrap.append(
      controls,
      createElement(
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
    button.closest('.dash-bulk-bar').hidden = statusDrafts.size === 0 && !isSaving;
    button.disabled = isSaving || statusDrafts.size === 0;
    button.textContent = statusDrafts.size
      ? `บันทึกทั้งหมด (${statusDrafts.size})`
      : 'บันทึกทั้งหมด';
    panel.querySelector('#dash-draft-count').textContent = statusDrafts.size
      ? `มี ${statusDrafts.size} รายการที่แก้ไขยังไม่บันทึก · รวมรายการที่ซ่อนด้วยตัวกรอง`
      : 'ไม่มีรายการที่แก้ไขค้างไว้';
  }
  async function saveAllStatuses() {
    if (isSaving || !statusDrafts.size) return;
    const request = loadGeneration;
    isSaving = true;
    panel.querySelectorAll('button,select,input').forEach((element) => (element.disabled = true));
    const count = panel.querySelector('#dash-draft-count');
    try {
      const result = await saveStatusDrafts(
        statusDrafts,
        (row, draft) =>
          api(`/api/dashboard/${row}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: draft.status, revision: draft.revision }),
          }),
        {
          isCurrent: () => request === loadGeneration,
          onProgress: (done, total) => {
            count.textContent = `กำลังบันทึก ${done}/${total}…`;
          },
        },
      );
      if (request !== loadGeneration) return;
      for (const saved of result.saved) {
        dashboardData.records = dashboardData.records.map((sourceRecord) =>
          sourceRecord.row === saved.row ? saved.result.record : sourceRecord,
        );
      }
      saveFeedback = `บันทึกสำเร็จ ${result.saved.length} รายการ`;
      if (result.failed.length)
        saveFeedback +=
          ` · ไม่สำเร็จ ${result.failed.length} รายการ (เก็บค่าที่เลือกไว้): ` +
          result.failed
            .map(
              (f) =>
                `${dashboardData.records.find((sourceRecord) => sourceRecord.row === f.row)?.asset || `แถว ${f.row}`}: ${f.message}`,
            )
            .join(' · ');
      try {
        const fresh = await api('/api/dashboard');
        if (request === loadGeneration) dashboardData = fresh;
      } catch (error) {
        saveFeedback += ` · โหลดข้อมูลล่าสุดไม่สำเร็จ: ${error.message}`;
      }
    } finally {
      isSaving = false;
      if (request === loadGeneration) renderDashboard();
    }
  }
  function renderList() {
    const target = panel.querySelector('#dash-list');
    target.replaceChildren();
    const normalized = searchQuery.trim().toLocaleLowerCase();
    const records = dashboardData.records.filter(
      (sourceRecord) =>
        (!inspectionFilter || sourceRecord.inspection === inspectionFilter) &&
        (!comparisonFilter || sourceRecord.comparison === comparisonFilter) &&
        (!teamFilter || (sourceRecord.team || '').trim() === teamFilter) &&
        (!normalized ||
          sourceRecord.values.some((fieldValue) =>
            fieldValue.toLocaleLowerCase().includes(normalized),
          )),
    );
    panel.querySelector('#dash-count').textContent =
      `แสดง ${records.length.toLocaleString('th-TH')} จาก ${dashboardData.total.toLocaleString('th-TH')} รายการ`;
    if (!records.length) {
      target.append(createElement('p', 'dash-empty', 'ไม่พบรายการตามตัวกรองที่เลือก'));
      return;
    }
    const table = createElement('table', 'dash-table');
    const thead = createElement('thead'),
      head = createElement('tr');
    [
      'เลขครุภัณฑ์ / อุปกรณ์',
      'S/N',
      'ผลตรวจ Apps Script',
      'การเทียบกับชีต',
      'ผู้ถือครอง / ทีม',
      'รายละเอียด',
    ].forEach((x) => {
      const th = createElement('th', '', x);
      th.scope = 'col';
      if (x === 'ผู้ถือครอง / ทีม') {
        th.replaceChildren();
        const select = createElement('select', 'dash-team-filter');
        select.setAttribute('aria-label', 'กรองตามทีม');
        const all = createElement(
          'option',
          '',
          window.matchMedia('(max-width: 760px)').matches
            ? 'เลือกทีมที่จะแสดง · ทุกทีม'
            : 'ผู้ถือครอง / ทีม · ทุกทีม',
        );
        all.value = '';
        select.append(all);
        const teams = [
          ...new Set(
            dashboardData.records
              .map((sourceRecord) => (sourceRecord.team || '').trim())
              .filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b, 'th'));
        for (const name of teams) {
          const option = createElement('option', '', name);
          option.value = name;
          select.append(option);
        }
        select.value = teamFilter;
        select.addEventListener('change', () => {
          teamFilter = select.value;
          renderList();
          panel.querySelector('.dash-team-filter')?.focus();
        });
        th.append(select);
      }
      head.append(th);
    });
    thead.append(head);
    table.append(thead);
    const body = createElement('tbody');
    records.forEach((sourceRecord) => {
      const tr = createElement(
        'tr',
        'dash-row ' +
          (sourceRecord.inspection === 'ยังไม่ตรวจ' ? '' : statusTone(sourceRecord.inspection)),
      );
      const identity = createElement('td');
      const asset = renderCopyableValue(sourceRecord.asset, 'เลขครุภัณฑ์');
      asset.classList.add('dash-asset');
      identity.append(
        asset,
        createElement('span', 'dash-item-name', sourceRecord.name || 'ไม่ระบุชื่ออุปกรณ์'),
      );
      const serial = createElement('td', 'dash-serial');
      serial.append(renderCopyableValue(sourceRecord.serial, 'S/N'));
      const status = createElement('td');
      status.append(renderStatusEditor(sourceRecord));
      const match = createElement('td');
      match.append(
        createElement(
          'span',
          'dash-badge ' + statusTone(sourceRecord.comparison),
          sourceRecord.comparison,
        ),
      );
      const owner = createElement('td');
      owner.append(
        createElement('span', '', sourceRecord.owner || '—'),
        createElement('span', 'dash-item-name', sourceRecord.team || ''),
      );
      const open = createElement('td');
      open.append(
        createActionButton('ดูข้อมูล', 'button dash-open', () => openRecordDetails(sourceRecord)),
      );
      tr.append(identity, serial, status, match, owner, open);
      body.append(tr);
    });
    table.append(body);
    target.append(table);
  }
  function renderDashboard() {
    panel.replaceChildren();
    const head = createElement('div', 'dash-heading');
    const title = createElement('div');
    title.append(createElement('h1', '', 'Dashboard'));
    const refresh = createActionButton('', 'button secondary dash-refresh', () => {
      statusDrafts.clear();
      saveFeedback = '';
      loadDashboard();
    });
    refresh.append(icon('refresh'));
    refresh.setAttribute('aria-label', 'โหลดข้อมูลล่าสุด');
    refresh.title = 'โหลดข้อมูลล่าสุด';
    head.append(title, refresh);
    panel.append(head);
    const bulk = createElement('div', 'dash-bulk-bar');
    const bulkMessage = createElement('span');
    bulkMessage.id = 'dash-draft-count';
    bulkMessage.setAttribute('role', 'status');
    const bulkSave = createActionButton('บันทึกทั้งหมด', 'button primary', saveAllStatuses);
    bulkSave.id = 'dash-save-all';
    bulk.append(bulkMessage, bulkSave);
    panel.append(bulk);
    updateBulkButton();
    if (saveFeedback) {
      const notice = createElement('p', 'dash-save-success', saveFeedback);
      notice.setAttribute('role', 'status');
      panel.append(notice);
    }
    const progress = createElement('section', 'dash-progress');
    const progressHead = createElement('div', 'dash-progress-head');
    progressHead.append(
      createElement('h2', '', 'ความคืบหน้าการตรวจ'),
      createElement('strong', '', `${dashboardData.percent.toLocaleString('th-TH')}%`),
    );
    const bar = createElement('progress');
    bar.max = dashboardData.total || 1;
    bar.value = dashboardData.completed;
    bar.setAttribute('aria-label', 'ความคืบหน้าการตรวจครุภัณฑ์');
    progress.append(
      progressHead,
      createElement(
        'p',
        'dash-progress-text',
        `ตรวจแล้ว ${dashboardData.completed.toLocaleString('th-TH')} / ${dashboardData.total.toLocaleString('th-TH')} รายการ`,
      ),
      bar,
    );
    panel.append(progress);
    const filters = createElement('details', 'dash-filters');
    filters.open = filtersOpen;
    const filterSummary = createElement('summary', '', 'ตัวกรองสถานะและการเทียบข้อมูล');
    filters.append(filterSummary);
    filters.addEventListener('toggle', () => {
      filtersOpen = filters.open;
    });
    panel.append(filters);
    filters.append(createElement('h2', 'dash-section-title', 'ผลตรวจ Apps Script (พัสดุ)'));
    const stats = createElement('div', 'dash-stats');
    for (const selector of [
      'ดี',
      'ชำรุด',
      'หาไม่เจอ',
      'ยังไม่ตรวจ',
      'อุปกรอื่นๆ',
      'กล้องวงจรปิด',
      ...(dashboardData.inspection['ไม่ระบุ'] ? ['ไม่ระบุ'] : []),
    ])
      stats.append(
        createStatusFilter(
          selector,
          dashboardData.inspection[selector] || 0,
          'รายการ',
          inspectionFilter === selector,
          () => {
            inspectionFilter = inspectionFilter === selector ? '' : selector;
            renderDashboard();
          },
        ),
      );
    filters.append(stats);
    filters.append(
      createElement(
        'h2',
        'dash-section-title',
        'ข้อมูล Apps Script (พัสดุ) เทียบกับ Google Sheets (IQI)',
      ),
    );
    const matches = createElement('div', 'dash-matches');
    Object.entries(dashboardData.comparison).forEach(([selector, count]) =>
      matches.append(
        createStatusFilter(
          selector,
          count,
          'ผลการเทียบข้อมูล',
          comparisonFilter === selector,
          () => {
            comparisonFilter = comparisonFilter === selector ? '' : selector;
            renderDashboard();
          },
        ),
      ),
    );
    filters.append(
      matches,
      createElement(
        'p',
        'dash-hint',
        '“หาไม่เจอ” ในการเทียบข้อมูล หมายถึงไม่พบข้อมูลในชีตต้นฉบับ เป็นคนละส่วนกับผลตรวจหาอุปกรณ์ไม่เจอ',
      ),
    );
    const tools = createElement('div', 'dash-tools');
    const input = createElement('input', 'dash-query');
    input.type = 'search';
    input.placeholder = 'ค้นหาเลขครุภัณฑ์ S/N อุปกรณ์ ผู้ถือครอง หรือหมายเหตุ';
    input.setAttribute('aria-label', 'ค้นหารายการ Dashboard');
    input.value = searchQuery;
    input.addEventListener('input', () => {
      searchQuery = input.value;
      renderList();
    });
    tools.append(
      input,
      createActionButton('ล้างตัวกรอง', 'button secondary', () => {
        inspectionFilter = '';
        comparisonFilter = '';
        teamFilter = '';
        searchQuery = '';
        renderDashboard();
      }),
    );
    panel.append(tools);
    const listHead = createElement('div', 'dash-list-head');
    const count = createElement('strong');
    count.id = 'dash-count';
    listHead.append(
      count,
      createElement(
        'span',
        'dash-hint',
        [inspectionFilter, comparisonFilter].filter(Boolean).join(' · ') || 'ทุกรายการ',
      ),
    );
    panel.append(listHead);
    const list = createElement('div', 'dash-list');
    list.id = 'dash-list';
    panel.append(list);
    const time = formatBangkokDisplayTimestamp(dashboardData.loadedAt);
    panel.append(
      createElement(
        'p',
        'dash-updated',
        `อ่านจากแท็บ Appscriptdata เมื่อ ${time} · แก้สถานะผ่านหน้านี้จะบันทึกลง Appscriptdata เท่านั้น`,
      ),
    );
    renderList();
  }
  show('dashboard');
  return {
    show: () => show(can('ADMIN_DASHBOARD_VIEW') ? 'dashboard' : 'search'),
    clear() {
      loadGeneration++;
      isLoading = false;
      isSaving = false;
      statusDrafts.clear();
      saveFeedback = '';
      dashboardData = null;
      inspectionFilter = '';
      comparisonFilter = '';
      teamFilter = '';
      searchQuery = '';
      panel.setAttribute('aria-busy', 'true');
      panel.replaceChildren(loadingSkeleton.cloneNode(true));
      detailsDialog.clear();
      show('dashboard');
    },
  };
}
