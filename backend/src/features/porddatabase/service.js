import { fingerprintJson } from '../../core/security/fingerprint.js';
import { dashboardData } from '../dashboard/data.js';
import { pdfReference } from './pdf-reference.js';
import { validateRequiredText as text } from '../../core/validation/values.js';
import { throwHttpError as fail } from '../../core/errors/errors.js';
import { writeLocked } from '../../core/state/stateStore.js';
import { formatBangkokTimestamp } from '../../../../shared/core/extensions/dates.js';
import { recordPhotos } from '../../../../shared/features/photos/slots.js';
import { pordDrivePhotos } from './drive-photos.js';

export const PORD_SHEET = 'PORDDATABASE';
// Already managed in พร้อมยืม; keep it out of this PORD import.
const EXCLUDED_ASSET = 'STEP61-107-041';
export const PORD_HEADERS = [
  'เลขครุภัณฑ์',
  'S/N',
  'ชื่ออุปกรณ์',
  'สภาพ',
  'ที่ตั้ง',
  'ราคาทุน',
  'วันที่อัปเดตล่าสุด',
  'รูป (ลิงก์)',
  'ชื่อผู้ถือครอง',
];
export const normalizeAsset = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u200b-\u200d\ufeff]+/g, '')
    .toUpperCase();

function validateGrid(grid) {
  if (
    grid.length &&
    ![PORD_HEADERS, PORD_HEADERS.slice(0, 8)].some(
      (headers) => JSON.stringify(grid[0]) === JSON.stringify(headers),
    )
  )
    fail(422, 'หัวคอลัมน์ชีตPORDDATABASEไม่ตรง กรุณาตรวจสอบก่อนส่ง');
}

function comparisonData(values) {
  const data = dashboardData(values);
  const found = new Set(data.records.map((r) => normalizeAsset(r.asset)));
  for (const [asset, pdf] of Object.entries(pdfReference)) {
    if (!found.has(asset))
      data.records.push({
        asset,
        row: 0,
        revision: fingerprintJson(pdf),
        name: '',
        serial: '',
        inspection: '',
        values: [],
      });
  }
  data.records = data.records.filter((r) => normalizeAsset(r.asset) !== EXCLUDED_ASSET);
  return data;
}

export class PordDatabase {
  constructor(adapter, photoStore) {
    this.adapter = adapter;
    this.photoStore = photoStore;
  }
  async read() {
    const [values, destination] = await Promise.all([
      this.adapter.readDashboard(),
      this.adapter.readPordDatabase(),
    ]);
    validateGrid(destination);
    const data = comparisonData(values);
    const drivePhotos = this.photoStore
      ? await pordDrivePhotos(
          this.photoStore,
          data.records.map((r) => normalizeAsset(r.asset)),
        )
      : new Map();
    const sent = new Set(destination.slice(1).map((r) => normalizeAsset(r[0])));
    return {
      sheet: PORD_SHEET,
      records: data.records.map((r) => {
        const get = (header) => r.values[data.headers.indexOf(header)] || '';
        const sourceId = normalizeAsset(r.asset);
        const photo = [
          ...new Set(
            [
              ...recordPhotos(data.headers, r.values).map((p) => p.url),
              ...get('ลิงก์รูปครุภัณฑ์').split('\n'),
              ...(drivePhotos.get(sourceId) || '').split('\n'),
            ]
              .map((url) => url.trim())
              .filter(Boolean),
          ),
        ].join('\n');
        const pdf = pdfReference[sourceId];
        const exported = destination.slice(1).find((e) => normalizeAsset(e[0]) === sourceId);
        return {
          sourceId,
          row: r.row,
          revision: r.revision,
          asset: exported?.[0] ?? r.asset,
          serial: exported?.[1] ?? (r.serial || get('S/N ในชีต')),
          name: exported?.[2] ?? r.name,
          status: exported?.[3] ?? (pdf?.status || r.inspection),
          location: exported?.[4] ?? '',
          owner: exported?.[8] ?? r.owner ?? '',
          photo: exported?.[7] ?? photo,
          drivePhoto: drivePhotos.get(sourceId) || '',
          cost: exported ? exported[5] || '' : pdf?.cost || '',
          pdfStatus: pdf?.status || '',
          pdfCost: pdf?.cost || '',
          appMatched: r.row > 0,
          appFields: {
            asset: r.asset,
            serial: r.serial || get('S/N ในชีต'),
            name: r.name,
            status: r.inspection,
            location: '',
            owner: r.owner || '',
            photo,
          },
          appStatus: r.inspection,
          pdfGroups: pdf?.groups || [],
          sent: sent.has(sourceId),
          source: Object.fromEntries(data.headers.map((h, i) => [h, r.values[i]])),
        };
      }),
    };
  }
  async send(body) {
    if (!Array.isArray(body?.records) || !body.records.length || body.records.length > 500)
      fail(400, 'กรุณาเลือก 1–500 รายการ');
    const records = body.records.map((r) => {
      const result = Object.fromEntries(
        [
          'sourceId',
          'revision',
          'asset',
          'serial',
          'name',
          'status',
          'location',
          'photo',
          'owner',
        ].map((key) => [
          key,
          text(
            r?.[key] ?? '',
            key === 'photo' ? 4000 : 500,
            ['sourceId', 'revision', 'asset', 'name'].includes(key),
          ),
        ]),
      );
      if (normalizeAsset(result.asset) !== result.sourceId)
        fail(400, 'เลขครุภัณฑ์ต้องตรงกับต้นทาง Appscriptdata');
      if (normalizeAsset(result.asset) === EXCLUDED_ASSET)
        fail(400, 'STeP61-107-041 อยู่ในพร้อมยืมแล้ว ไม่ต้องส่งเข้า PORDDATABASE');
      const photos = result.photo
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      for (const photo of photos) {
        let url;
        try {
          url = new URL(photo);
        } catch {
          fail(400, 'ลิงก์รูปแต่ละบรรทัดต้องเป็น http หรือ https ที่ถูกต้อง');
        }
        if (!['http:', 'https:'].includes(url.protocol))
          fail(400, 'ลิงก์รูปแต่ละบรรทัดต้องเป็น http หรือ https ที่ถูกต้อง');
      }
      result.photo = photos.join('\n');
      if (r.owner === undefined) delete result.owner;
      return result;
    });
    if (
      new Set(records.map((r) => r.sourceId)).size !== records.length ||
      new Set(records.map((r) => normalizeAsset(r.asset))).size !== records.length
    )
      fail(409, 'รายการที่เลือกมีเลขครุภัณฑ์ซ้ำ');
    // shortcut: lock is process-local, use a distributed lock before enabling concurrent writers across deployments.
    return writeLocked(this.adapter, async () => {
      const [source, grid] = await Promise.all([
        this.adapter.readDashboard(),
        this.adapter.readPordDatabase(),
      ]);
      validateGrid(grid);
      const fresh = comparisonData(source).records;
      const existing = grid.slice(1).filter((r) => r[0]);
      const append = [],
        skipped = [];
      for (const r of records) {
        if (existing.some((e) => normalizeAsset(e[0]) === normalizeAsset(r.asset))) {
          skipped.push(r.sourceId);
          continue;
        }
        const matches = fresh.filter((e) => normalizeAsset(e.asset) === r.sourceId);
        if (matches.length !== 1 || matches[0].revision !== r.revision)
          fail(409, `ข้อมูลต้นทาง ${r.asset} เปลี่ยนหรือซ้ำ กรุณาโหลดข้อมูลและตรวจสอบใหม่`);
        if (existing.some((e) => normalizeAsset(e[0]) === normalizeAsset(r.asset)))
          fail(409, `เลขครุภัณฑ์ ${r.asset} มีในชีตใหม่แล้ว`);
        append.push([
          r.asset,
          r.serial,
          r.name,
          r.status,
          r.location,
          pdfReference[r.sourceId]?.cost || '',
          formatBangkokTimestamp(),
          r.photo,
          r.owner ?? matches[0].owner ?? '',
        ]);
      }
      if (append.length) await this.adapter.appendPordDatabase(append, PORD_HEADERS);
      const saved = await this.adapter.readPordDatabase();
      validateGrid(saved);
      const sent = records
        .filter((r) => saved.slice(1).some((e) => normalizeAsset(e[0]) === normalizeAsset(r.asset)))
        .map((r) => r.sourceId);
      if (sent.length !== records.length)
        fail(502, 'ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่');
      return { sent, added: append.length, skipped: skipped.length, sheet: PORD_SHEET };
    });
  }
}
