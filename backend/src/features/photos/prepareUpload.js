import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { throwHttpError as fail } from '../../core/errors/errors.js';
export async function preparePhoto(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > 25 * 1024 * 1024)
    fail(400, 'รูปต้องมีขนาดไม่เกิน 25 MB');
  let buffer = input;
  const isHeic =
    input.length > 12 &&
    input.toString('ascii', 4, 8) === 'ftyp' &&
    /heic|heix|hevc|hevx|mif1|msf1/.test(input.toString('ascii', 8, 64));
  if (isHeic) {
    try {
      buffer = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 0.9 }));
    } catch {
      fail(400, 'แปลง HEIC ไม่สำเร็จ กรุณาเลือก JPEG หรือถ่ายรูปใหม่');
    }
  }
  try {
    return await sharp(buffer, { limitInputPixels: 80000000, animated: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#fff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    fail(400, 'อ่านรูปไม่ได้ รองรับ JPEG, PNG, WebP และ HEIC/HEIF');
  }
}
