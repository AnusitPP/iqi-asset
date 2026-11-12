export const photoHeaders = [
  'รูป1',
  'รูป2',
  'รูป3',
  'ลิงก์รูปครุภัณฑ์',
  'รูปขนาดเต็ม',
  'รูปรหัสครุภัณฑ์',
];
export function extractUniqueDrivePhotos(headers: string[], values: string[]) {
  const ids = new Set<string>(),
    photos: { id: string; url: string }[] = [];
  for (const header of photoHeaders)
    for (const url of (values[headers.indexOf(header)] ?? '').split('\n')) {
      const id = url.trim().match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/)?.[1];
      if (id && !ids.has(id)) {
        ids.add(id);
        photos.push({ id, url: url.trim() });
      }
    }
  return photos;
}
export function validatePhotoUploadSelection(files: File[], remaining: number) {
  if (!files.length) throw new Error('กรุณาเลือกรูปครุภัณฑ์');
  if (files.length > remaining) throw new Error(`เลือกได้อีก ${remaining} รูปเท่านั้น`);
  for (const file of files) {
    if (
      !file.type.startsWith('image/') &&
      !/\.(jpe?g|png|webp|hei[cf]|gif|avif|bmp|tiff?)$/i.test(file.name)
    )
      throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }
}
export async function preparePhotoForUpload(file: File, maxUploadBytes: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      // Load the HEIC decoder only when native decoding fails, without weakening CSP.
      const { isHeic, heicTo } = await import('heic-to/csp');
      if (!(await isHeic(file))) throw new Error('Unsupported image');
      bitmap = await heicTo({ blob: file, type: 'bitmap' });
    } catch {
      throw new Error('ไม่สามารถอ่านรูปนี้ได้ ไฟล์อาจเสียหายหรือเป็นรูปแบบที่ยังไม่รองรับ');
    }
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement('canvas');
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการย่อรูป');
    for (;;) {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.82, 0.68, 0.54]) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
            'image/jpeg',
            quality,
          ),
        );
        if (blob.size <= maxUploadBytes) return blob;
      }
      if (Math.max(width, height) <= 320)
        throw new Error('ย่อรูปแล้วยังเกินขนาดที่เซิร์ฟเวอร์รับได้ กรุณาเลือกรูปอื่น');
      width = Math.max(1, Math.round(width * 0.75));
      height = Math.max(1, Math.round(height * 0.75));
    }
  } finally {
    bitmap.close();
  }
}
