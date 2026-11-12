import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
import { assetIdentityKey } from '../../../../shared/features/catalog/search.js';
import { formatBangkokTimestamp } from '../../../../shared/core/extensions/dates.js';
import { validateRequiredText } from '../../core/validation/values.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { preparePhoto } from '../photos/prepareUpload.js';
import { LOAN_TYPES } from '../../../../shared/features/lending/formConstants.js';
import { catalogCategory } from '../../../../shared/features/catalog/search.js';

export const CATALOG_HEADERS = [
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'วันที่อัปเดตล่าสุด',
  'รูป (ลิงก์)',
];
export function catalogHeaders(grid) {
  const headers = (grid[0] || []).map((value) => String(value).trim());
  if (CATALOG_HEADERS.some((name) => headers.filter((header) => header === name).length !== 1))
    fail(422, 'หัวคอลัมน์ชีตพร้อมยืมไม่ตรง กรุณาตรวจสอบ');
  if (headers.filter((header) => header === 'หมวดหมู่').length > 1)
    fail(422, 'ชีตพร้อมยืมมีคอลัมน์หมวดหมู่ซ้ำ');
  return headers;
}
export class CatalogEditor {
  constructor(ledger, store) {
    this.ledger = ledger;
    this.adapter = ledger.adapter;
    this.store = store;
  }
  create(body) {
    const record = {
      asset: validateRequiredText(body?.asset, 200),
      serial: validateRequiredText(body?.serial ?? '', 200, false),
      name: validateRequiredText(body?.name, 200),
    };
    record.category = validateRequiredText(body?.category ?? catalogCategory(record.name), 200);
    if (!LOAN_TYPES.includes(record.category)) fail(400, 'กรุณาเลือกหมวดหมู่จากรายการ');
    return this.ledger.withWriteLock(() =>
      writeLocked(this.adapter, async () => {
        const grid = await this.adapter.readReadyToBorrow();
        const headers = catalogHeaders(grid);
        if (
          readyToBorrowData(grid).records.some(
            (entry) => assetIdentityKey(entry) === assetIdentityKey(record),
          )
        )
          fail(409, 'มีเลขครุภัณฑ์และ S/N นี้ในชีตพร้อมยืมแล้ว');
        if (!headers.includes('หมวดหมู่')) {
          await this.adapter.addReadyToBorrowCategory(headers.length);
          headers.push('หมวดหมู่');
        }
        const values = {
          เลขครุภัณฑ์: record.asset,
          'S/N': record.serial,
          ชื่ออุปกรณ์: record.name,
          หมวดหมู่: record.category,
          วันที่อัปเดตล่าสุด: formatBangkokTimestamp(),
          'รูป (ลิงก์)': '',
        };
        await this.adapter.appendReadyToBorrow(headers.map((header) => values[header] ?? ''));
        const saved = readyToBorrowData(await this.adapter.readReadyToBorrow()).records.filter(
          (entry) => assetIdentityKey(entry) === assetIdentityKey(record),
        );
        if (saved.length !== 1) fail(409, 'บันทึกแล้วแต่ยืนยันรายการไม่ได้ กรุณาโหลดข้อมูลล่าสุด');
        return saved[0];
      }),
    );
  }
  remove(row, expected) {
    return this.ledger.withWriteLock(() =>
      writeLocked(this.adapter, async () => {
        if (!Number.isInteger(row) || row < 2) fail(400, 'ข้อมูลอ้างอิงรายการไม่ถูกต้อง');
        const grid = await this.adapter.readReadyToBorrow();
        catalogHeaders(grid);
        const records = readyToBorrowData(grid).records;
        const record = records.find((entry) => entry.row === row);
        if (
          !record ||
          !expected ||
          !['asset', 'serial', 'name', 'photo', 'category'].every(
            (key) => (record[key] ?? '') === (expected[key] ?? ''),
          ) ||
          records.filter((entry) => assetIdentityKey(entry) === assetIdentityKey(record)).length !==
            1
        )
          fail(409, 'ข้อมูลรายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนลบ');
        const state = await this.ledger.readLedger();
        if (
          state.active.some(
            (entry) =>
              assetIdentityKey({ asset: entry[7], serial: entry[8] || '' }) ===
              assetIdentityKey(record),
          )
        )
          fail(409, 'ลบไม่ได้ เนื่องจากมีคำขอยืมหรือกำลังยืมรายการนี้อยู่');
        const fresh = await this.adapter.readReadyToBorrow();
        if (
          JSON.stringify(fresh[0]) !== JSON.stringify(grid[0]) ||
          JSON.stringify(fresh[row - 1]) !== JSON.stringify(grid[row - 1])
        )
          fail(409, 'ข้อมูลรายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนลบ');
        // Clear values without shifting the row numbers used by other open forms.
        await this.adapter.clearReadyToBorrow(row);
        if (
          readyToBorrowData(await this.adapter.readReadyToBorrow()).records.some(
            (entry) => entry.row === row,
          )
        )
          fail(409, 'ยังยืนยันการลบไม่ได้ กรุณาโหลดรายการล่าสุด');
        const ids = new Set();
        for (const value of (record.photo || '').split('\n')) {
          try {
            const url = new URL(value.trim());
            const id =
              url.pathname.match(/^\/file\/d\/([\w-]+)\/view$/)?.[1] || url.searchParams.get('id');
            if (
              url.protocol === 'https:' &&
              url.hostname === 'drive.google.com' &&
              /^[\w-]+$/.test(id || '')
            )
              ids.add(id);
          } catch {
            /* Keep unrecognized external links untouched. */
          }
        }
        const result = { deleted: true, photosTrashed: 0, photosKept: 0, photosPending: 0 };
        if (!ids.size) return result;
        let references;
        try {
          references = await this.adapter.readPhotoReferences();
        } catch {
          return { ...result, photosPending: ids.size };
        }
        for (const id of ids) {
          if (references.some((value) => String(value).includes(id))) {
            result.photosKept++;
            continue;
          }
          try {
            if (await this.store.trash(id)) result.photosTrashed++;
            else result.photosKept++;
          } catch {
            result.photosPending++;
          }
        }
        return result;
      }),
    );
  }
  upload(row, identity, input) {
    try {
      identity = decodeURIComponent(identity);
    } catch {
      fail(400, 'ข้อมูลอ้างอิงครุภัณฑ์ไม่ถูกต้อง');
    }
    return this.ledger.withWriteLock(() =>
      writeLocked(this.adapter, async () => {
        const grid = await this.adapter.readReadyToBorrow();
        const headers = catalogHeaders(grid);
        const record = readyToBorrowData(grid).records.find((entry) => entry.row === row);
        if (!record || JSON.stringify([record.asset, record.serial]) !== identity)
          fail(409, 'ข้อมูลเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด');
        const existingPhotos = (record.photo || '')
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean);
        if (existingPhotos.length >= 3) fail(409, 'รายการนี้มีครบ 3 รูปแล้ว');
        const buffer = await preparePhoto(input);
        const photo = await this.store.upload(buffer, `catalog_${Date.now()}.jpg`, record.asset);
        try {
          const fresh = await this.adapter.readReadyToBorrow();
          if (
            JSON.stringify(fresh[0]) !== JSON.stringify(grid[0]) ||
            JSON.stringify(fresh[row - 1]) !== JSON.stringify(grid[row - 1])
          )
            throw new Error('changed');
          await this.adapter.writeReadyToBorrowPhoto(
            row,
            headers,
            [...existingPhotos, photo.url].join('\n'),
            formatBangkokTimestamp(),
          );
          const saved = readyToBorrowData(await this.adapter.readReadyToBorrow()).records.find(
            (entry) => entry.row === row,
          );
          if (saved?.photo !== [...existingPhotos, photo.url].join('\n'))
            throw new Error('not saved');
        } catch {
          fail(
            409,
            `รูปอยู่ใน Drive แล้ว แต่ผูกกับชีตไม่สำเร็จ กรุณาเก็บลิงก์นี้ไว้: ${photo.url}`,
          );
        }
        return { url: photo.url };
      }),
    );
  }
  async readPhoto(id) {
    if (!/^[\w-]+$/.test(id)) fail(404, 'ไม่พบรูป');
    const records = readyToBorrowData(await this.adapter.readReadyToBorrow()).records;
    if (
      !records.some((entry) =>
        (entry.photo || '').split('\n').some((photo) => {
          try {
            const url = new URL(photo.trim());
            return (
              url.protocol === 'https:' &&
              url.hostname === 'drive.google.com' &&
              (url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get('id')) === id
            );
          } catch {
            return false;
          }
        }),
      )
    )
      fail(404, 'ไม่พบรูปในชีตพร้อมยืม');
    return this.store.read(id);
  }
}
