import { can } from '../auth/permissions.js';
import { displayFieldValue } from '/shared/core/formatters/labels.js';
import { selectElement, createElement, createButton as button } from '../../core/dom/elements.js';
import { debounce } from '../../core/functions/debounce.js';
import { copyText } from '../../core/browser/clipboard.js';
import { icon } from '../../core/components/icons.js';
import { todayBangkok, inspectionAge } from '/shared/core/extensions/dates.js';
import { initializeRecordDetails } from '../recordDetails/editor.js';
import { initializeReviewInspection } from '../review/inspection.js';
export function initializeSearch({ api, connect, getCsrf, toast }) {
  let lastSearchQuery = '';
  const recordDetails = initializeRecordDetails({
    api,
    toast,
    getSearchQuery: () => lastSearchQuery,
    refreshSearch: searchRecords,
  });
  const { openDetail } = recordDetails;
  const { openInspection } = initializeReviewInspection({
    api,
    toast,
    getResults: () => lastResult,
    onResultsChanged: renderSearchResults,
  });
  let searchId = 0,
    searchController = null;
  const initialResults = selectElement('#results').cloneNode(true);
  let lastResult = null;
  const pendingWrites = new Set();
  const pendingKey = (sheet, row) => JSON.stringify([sheet, row]);
  function invalidateSearch() {
    searchId++;
    searchController?.abort();
    setSearchLoading(false);
  }
  function showError(message) {
    selectElement('#page-error').textContent = message;
    selectElement('#page-error').hidden = false;
  }
  function setSearchLoading(busy) {
    const target = selectElement('#search-button');
    target.disabled = busy;
    target.replaceChildren(document.createTextNode(busy ? 'กำลังค้นหา…' : 'ค้นหา'));
    if (!busy) target.append(icon('search'));
    selectElement('#results').setAttribute('aria-busy', String(busy));
  }
  async function searchRecords(query) {
    delayedSearch.cancel();
    invalidateSearch();
    const requestId = searchId;
    const controller = new AbortController();
    searchController = controller;
    lastSearchQuery = query;
    selectElement('#page-error').hidden = true;
    setSearchLoading(true);
    try {
      if (!getCsrf() && !(await connect())) return;
      if (requestId !== searchId) return;
      const result = await api(
        `/api/search?q=${encodeURIComponent(query)}&pendingOnly=${selectElement('#pending-only').checked ? '1' : '0'}`,
        { signal: controller.signal },
      );
      if (requestId === searchId) renderSearchResults(result);
    } catch (error) {
      if (requestId !== searchId || error.name === 'AbortError') return;
      showError(error.message);
      selectElement('#results').replaceChildren(
        createElement(
          'div',
          'result-failure',
          'ยังโหลดผลค้นหาไม่ได้ กรุณาลองพิมพ์หรือกดค้นหาอีกครั้ง',
        ),
      );
    } finally {
      if (requestId === searchId) setSearchLoading(false);
    }
  }
  const delayedSearch = debounce(searchRecords, 300);
  function onQueryInput(event) {
    delayedSearch.cancel();
    invalidateSearch();
    selectElement('#page-error').hidden = true;
    const query = selectElement('#query').value.trim();
    lastSearchQuery = query;
    if (!query && !selectElement('#pending-only').checked) {
      lastResult = null;
      selectElement('#results').replaceChildren(...initialResults.cloneNode(true).childNodes);
      return;
    }
    selectElement('#results').replaceChildren(createElement('div', 'loading', 'กำลังค้นหาข้อมูล…'));
    if (!event.isComposing) delayedSearch(query);
  }
  selectElement('#query').addEventListener('input', onQueryInput);
  selectElement('#query').addEventListener('compositionend', onQueryInput);
  selectElement('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = selectElement('#query').value.trim();
    if (query || selectElement('#pending-only').checked) searchRecords(query);
  });
  selectElement('#pending-only').addEventListener('change', () => {
    onQueryInput({ isComposing: false });
    const query = selectElement('#query').value.trim();
    if (query || selectElement('#pending-only').checked) searchRecords(query);
  });
  async function toggleReviewSelection(record, group, control) {
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
      const query = selectElement('#query').value.trim();
      if (query || selectElement('#pending-only').checked) await searchRecords(query);
      else if (lastResult === shown && searchId === searchAtClick) renderSearchResults(shown);
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
      document.querySelectorAll('.pending-heart').forEach((createElement) => {
        if (createElement.dataset.pendingKey === key) {
          createElement.disabled = false;
          createElement.removeAttribute('aria-busy');
        }
      });
    }
  }
  function renderSearchResults(result) {
    lastResult = result;
    const today = todayBangkok();
    const container = selectElement('#results');
    container.replaceChildren();
    const heading = createElement('div', 'results-heading');
    const text = createElement('div');
    text.append(
      createElement('div', 'eyebrow', 'SEARCH RESULTS'),
      createElement(
        'h2',
        '',
        !result.query && result.pendingOnly
          ? 'รายการรอตรวจสอบทั้งหมด'
          : `ผลการค้นหา “${result.query}”`,
      ),
    );
    const total = result.groups.reduce((element, g) => element + g.count, 0);
    heading.append(
      text,
      createElement('span', 'result-total', `${total} รายการ / ${result.groups.length} กลุ่ม`),
    );
    container.append(heading);
    const groups = createElement('div', 'result-groups');
    result.groups
      .filter((group) => !result.pendingOnly || group.count > 0)
      .forEach((group, index) => {
        const card = createElement('section', 'result-group');
        if (group.reviewGroup) card.classList.add('review-group');
        const header = createElement('div', 'group-header');
        const title = createElement('div', 'group-title');
        const mark = createElement('span', `sheet-symbol sheet-${index}`);
        mark.append(icon('sheet'));
        const name = createElement('div');
        name.append(
          createElement('h3', '', group.label),
          createElement(
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
          createElement('span', group.count ? 'count found' : 'count', `${group.count} รายการ`),
        );
        card.append(header);
        if (group.sheet !== group.label)
          card.append(createElement('p', 'actual-sheet', `แท็บ: ${group.sheet}`));
        if (group.count && group.matchType === 'fallback')
          card.append(createElement('p', 'fallback-note', 'พบจากเลขเก่า 2 ส่วนท้าย'));
        if (!group.count) {
          const empty = createElement('div', 'group-empty');
          empty.append(
            createElement('span', '', '—'),
            createElement(
              'p',
              '',
              result.pendingOnly ? 'ไม่พบรายการรอค้นหา' : 'ไม่พบข้อมูลที่ตรงกันใน Sheet นี้',
            ),
          );
          card.append(empty);
        }
        group.records.forEach((record) => {
          const sourceSheet = record.sourceSheet || group.sheet;
          const item = createElement(
            'article',
            `result-item${record.inspected && record.pending ? ' is-inspected' : ''}`,
          );
          item.dataset.inspectionStatus = record.inspectionStatus || '';
          if (record.inspected && record.pending)
            item.setAttribute('aria-label', `${record.asset || 'ครุภัณฑ์'} บันทึกผลตรวจแล้ว`);
          const topline = createElement('div', 'result-item-top');
          const code = createElement('h4', 'asset-code', record.asset || '—');
          code.title = record.asset || '—';
          const codeGroup = createElement('div', 'asset-code-group');
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
          const stamp = createElement('div', 'inspection-stamp');
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
              createElement(
                'span',
                'inspection-missing',
                record.inspectionDate ? 'วันที่ตรวจไม่ถูกต้อง' : 'ไม่ระบุวันที่ตรวจ',
              ),
            );
          topline.append(stamp);
          if (can('ASSET_EDIT')) {
            const heart = button(
              '',
              `pending-heart${record.pending ? ' is-pending' : ''}`,
              () => toggleReviewSelection(record, group, heart),
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
          const description = createElement(
            'p',
            'asset-description',
            [record.name || 'ไม่ระบุรายการ', record.brand].filter(Boolean).join(' · '),
          );
          description.title = description.textContent;
          item.append(topline, description);
          const identity = createElement('div', 'identity-line');
          const identityLabels = [];
          for (const [label, value] of [
            ['ชื่อ', record.owner],
            ['ชื่อย่อ', record.initials],
            ['ชื่อเล่น', record.nickname],
            ['ทีม', displayFieldValue('ทีม', record.team || '')],
          ]) {
            const part = createElement(
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
            item.append(createElement('p', 'review-location', `อยู่ในชีต ${record.reviewSheet}`));
          item.append(
            button(
              'ดูรายละเอียด',
              'button detail-button',
              () => openDetail(sourceSheet, record.row),
              'arrow',
            ),
          );
          if (record.pending && can('ASSET_EDIT'))
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
        createElement(
          'p',
          'no-results-help',
          result.pendingOnly
            ? 'ไม่พบรายการรอค้นหาที่ตรงกับตัวกรอง'
            : 'ไม่พบเลขนี้ในทั้ง 3 Sheet ลองตรวจสอบตัวเลขและเครื่องหมายขีดอีกครั้ง',
        ),
      );
  }

  return {
    showError,
    hasUnsavedChanges: recordDetails.hasUnsavedChanges,
    clear() {
      delayedSearch.cancel();
      invalidateSearch();
      recordDetails.clear();
      selectElement('#query').value = '';
      selectElement('#pending-only').checked = false;
      onQueryInput({ isComposing: false });
    },
  };
}
