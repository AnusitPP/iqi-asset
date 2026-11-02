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
    if (file.size > 25 * 1024 * 1024) throw new Error('รูปต้องมีขนาดไม่เกิน 25 MB');
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) &&
      !/\.hei[cf]$/i.test(file.name)
    )
      throw new Error('กรุณาเลือก JPEG, PNG, WebP หรือ HEIC');
  }
}
export async function preparePhotoForUpload(file: File, maxUploadBytes: number): Promise<Blob> {
  const validatePreparedPhotoSize = (blob: Blob) => {
    if (blob.size > maxUploadBytes)
      throw new Error(
        `รูปที่ส่งต้องไม่เกิน ${maxUploadBytes / 1024 / 1024} MB กรุณาย่อหรือแปลงเป็น JPEG ก่อน`,
      );
    return blob;
  };
  if (file.size > 25 * 1024 * 1024) throw new Error('เลือกภาพขนาดไม่เกิน 25 MB');
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type))
    return validatePreparedPhotoSize(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('อ่านรูปไม่ได้ กรุณาเลือก JPEG, PNG, WebP หรือ HEIC');
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการย่อรูป');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return validatePreparedPhotoSize(
      await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
          'image/jpeg',
          0.82,
        ),
      ),
    );
  } finally {
    bitmap.close();
  }
}
