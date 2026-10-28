export const PHOTO_SLOTS = ['รูป1', 'รูป2', 'รูป3'];
export const LEGACY_PHOTO_HEADERS = ['ลิงก์รูปครุภัณฑ์', 'รูปขนาดเต็ม', 'รูปรหัสครุภัณฑ์'];
export const MAX_PHOTOS = 3;
export function recordPhotos(headers, values) {
  const ids = new Set();
  const photos = [];
  for (const header of [...PHOTO_SLOTS, ...LEGACY_PHOTO_HEADERS]) {
    for (const url of String(values[headers.indexOf(header)] || '').split('\n')) {
      const id = url.trim().match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/)?.[1];
      if (id && !ids.has(id)) {
        ids.add(id);
        photos.push({ id, url: url.trim() });
      }
    }
  }
  return photos;
}
