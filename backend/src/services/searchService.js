export function normalizeAsset(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—−﹘﹣－]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-');
}
const headerKey = (value) => normalizeAsset(value).replace(/[\s._()]/g, '');
const deviceAliases = [
  ['จอ', 'หน้าจอ', 'จอภาพ', 'monitor', 'screen'],
  [
    'โน้ตบุ๊ก',
    'โน๊ตบุ๊ค',
    'โน้ตบุ๊ค',
    'แล็ปท็อป',
    'แล็ปท็อป',
    'notebook',
    'laptop',
    'laptop computer',
    'คอมพิวเตอร์พกพา',
  ],
  ['คอมตั้งโต๊ะ', 'คอมพิวเตอร์ตั้งโต๊ะ', 'desktop', 'desktop computer', 'pc'],
  ['เครื่องพิมพ์', 'ปรินเตอร์', 'ปริ้นเตอร์', 'พรินเตอร์', 'printer'],
  ['เมาส์', 'mouse'],
  ['คีย์บอร์ด', 'แป้นพิมพ์', 'keyboard'],
  ['สแกนเนอร์', 'scanner'],
  ['โปรเจคเตอร์', 'โปรเจ็กเตอร์', 'projector'],
].map((group) => group.map(normalizeAsset));
export function parseSheet(sheet, values = [], formulaValues = values) {
  const headerIndex = values.findIndex((row) =>
    row.some((value) => headerKey(value) === 'เลขครุภัณฑ์'),
  );
  if (headerIndex < 0)
    throw Object.assign(new Error(`Sheet ${sheet}: ไม่พบ header “เลขครุภัณฑ์”`), { status: 422 });
  const width = values.reduce((max, row) => Math.max(max, row.length), values[headerIndex].length);
  const headers = Array.from({ length: width }, (_, i) => String(values[headerIndex][i] ?? ''));
  const assetIndex = headers.findIndex((value) => headerKey(value) === 'เลขครุภัณฑ์');
  if (headers.filter((value) => headerKey(value) === 'เลขครุภัณฑ์').length !== 1)
    throw Object.assign(new Error(`Sheet ${sheet}: มี header เลขครุภัณฑ์ซ้ำ กรุณาตรวจสอบ`), {
      status: 422,
    });
  const records = values.slice(headerIndex + 1).flatMap((row, i) =>
    row.some((v) => String(v ?? '').trim())
      ? [
          {
            sheet,
            row: headerIndex + i + 2,
            values: Array.from({ length: width }, (_, c) => String(row[c] ?? '')),
            formulas: Array.from(
              { length: width },
              (_, c) => formulaValues[headerIndex + i + 1]?.[c] ?? '',
            ),
          },
        ]
      : [],
  );
  return { sheet, headers, headerRow: headerIndex + 1, assetIndex, records };
}
export function findRecords(table, query) {
  const full = normalizeAsset(query);
  if (!full) return { records: [], matchType: 'partial' };
  const deviceIndices = table.headers.flatMap((h, i) =>
    ['รายการ', 'อุปกรณ์', 'รายการ/อุปกรณ์', 'ชื่อเครื่อง', 'ชื่ออุปกรณ์', 'ประเภท'].includes(
      headerKey(h),
    )
      ? [i]
      : [],
  );
  const variants = (term) => deviceAliases.find((group) => group.includes(term)) || [];
  const wholeAliases = variants(full),
    terms = full.split(' ');
  let records = table.records.filter((record) => {
    const cells = record.values.map(normalizeAsset),
      devices = deviceIndices.map((i) => cells[i]);
    const matches = (term) =>
      cells.some((value) => value.includes(term)) ||
      devices.some((value) => variants(term).some((alias) => value.includes(alias)));
    return (
      cells.some((value) => value.includes(full)) ||
      devices.some((value) => wholeAliases.some((alias) => value.includes(alias))) ||
      terms.every(matches)
    );
  });
  let matchType = 'partial';
  const segments = full.split('-');
  if (!records.length && segments.length > 2 && segments.slice(-2).every(Boolean)) {
    const suffix = segments.slice(-2).join('-');
    records = table.records.filter(
      (record) => normalizeAsset(record.values[table.assetIndex]) === suffix,
    );
    matchType = 'fallback';
  }
  return { records, matchType };
}
export function inspectionDate(headers, configured = '') {
  if (configured) {
    const indices = headers.flatMap((h, i) => (h === configured ? [i] : []));
    return indices.length === 1 ? indices[0] : null;
  }
  const candidates = headers.flatMap((h, i) =>
    /^(วันที่ตรวจสอบ|วันที่ตรวจเช็ค|วันที่ตรวจเช็ก|วันที่ตรวจ|inspectiondate|lastinspectiondate|วันที่ตรวจครุภัณฑ์)$/.test(
      headerKey(h),
    )
      ? [i]
      : [],
  );
  return candidates.length === 1 ? candidates[0] : null;
}
export function todayBangkok(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('day')}/${get('month')}/${Number(get('year')) + 543}`;
}
export function columnName(index) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
