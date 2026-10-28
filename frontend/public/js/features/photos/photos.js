let maxUploadBytes = 25 * 1024 * 1024;
export function setUploadLimit(bytes) {
  if (Number.isFinite(bytes) && bytes > 0) maxUploadBytes = bytes;
}
function checkUploadSize(file) {
  if (file.size > maxUploadBytes)
    throw new Error(
      `รูปที่ส่งต้องไม่เกิน ${maxUploadBytes / 1024 / 1024} MB กรุณาย่อหรือแปลงเป็น JPEG ก่อน`,
    );
  return file;
}
export async function resizeForUpload(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('เลือกภาพขนาดไม่เกิน 25 MB');
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) return checkUploadSize(file);
  let bitmap;
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
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return checkUploadSize(
      await new Promise((resolve, reject) =>
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
