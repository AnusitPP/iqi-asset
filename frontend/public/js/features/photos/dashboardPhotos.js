import { createElement, createButton as createActionButton } from '../../core/dom/elements.js';
import { recordPhotos, MAX_PHOTOS } from '/shared/features/photos/slots.js';
import { resizeForUpload } from './prepareUpload.js';
export function initializeDashboardPhotos({ api, state, renderDashboard, openDetails, modal }) {
  let clearPreviews = () => {};
  function photoEditor(record) {
    const section = createElement('section', 'dash-photo-section');
    const photos = recordPhotos(state.data.headers, record.values);
    section.append(createElement('h3', '', 'รูปครุภัณฑ์ · ' + photos.length + '/' + MAX_PHOTOS));
    const gallery = createElement('div', 'dash-photo-gallery');
    for (const [index, photo] of photos.entries()) {
      const link = createElement('a');
      link.href = photo.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const img = createElement('img');
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
      section.append(createElement('p', 'dash-hint', 'ครบ 3 รูปแล้ว'));
      return section;
    }
    const controls = createElement('div', 'dash-photo-controls');
    const input = createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
    input.setAttribute('aria-label', 'เลือกรูปครุภัณฑ์ ' + record.asset);
    const previews = createElement('div', 'dash-photo-gallery');
    let previewUrls = [];
    clearPreviews = () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls = [];
    };
    const message = createElement('p', 'dash-hint');
    message.setAttribute('role', 'status');
    message.textContent = 'เลือกพร้อมกันได้อีก ' + remaining + ' รูป · ไม่เกิน 25 MB/รูป';
    const upload = createActionButton('อัปโหลด', 'button primary', async () => {
      const files = Array.from(input.files || []);
      if (state.saving || !files.length) return;
      if (files.length > remaining) {
        message.textContent = 'เลือกได้อีก ' + remaining + ' รูปเท่านั้น';
        return;
      }
      if (files.some((f) => f.size > 25 * 1024 * 1024)) {
        message.textContent = 'รูปต้องมีขนาดไม่เกิน 25 MB';
        return;
      }
      state.saving = true;
      upload.disabled = true;
      input.disabled = true;
      const request = state.version;
      let revision = record.revision,
        completed = 0,
        errorMessage = '';
      try {
        for (const file of files) {
          message.textContent = 'กำลังอัปโหลด ' + (completed + 1) + '/' + files.length + '…';
          const blob = await resizeForUpload(file);
          if (request !== state.version) break;
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
        state.saving = false;
        input.disabled = false;
        upload.disabled = false;
      }
      if (request !== state.version) return;
      const summary =
        (completed ? 'เพิ่มแล้ว ' + completed + '/' + files.length + ' รูป' : '') +
        (errorMessage ? ' · ' + errorMessage : '');
      if (!completed) {
        message.textContent = errorMessage;
        return;
      }
      try {
        state.data = await api('/api/dashboard');
        if (request !== state.version) return;
        state.feedback = summary;
        renderDashboard();
        const fresh = state.data.records.find((sourceRecord) => sourceRecord.row === record.row);
        if (fresh) {
          openDetails(fresh);
          modal
            .querySelector('[role="status"]')
            ?.append(createElement('span', '', ' · ' + summary));
        }
      } catch (error) {
        message.textContent = summary + ' · โหลดข้อมูลล่าสุดไม่สำเร็จ: ' + error.message;
      }
    });
    upload.disabled = true;
    input.addEventListener('change', () => {
      clearPreviews();
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
        const img = createElement('img');
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

  return { render: photoEditor, clearPreviews: () => clearPreviews() };
}
