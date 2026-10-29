import { fingerprintJson } from '../../core/security/fingerprint.js';
const revision = (headers, row) =>
  fingerprintJson([headers, headers.map((_, index) => String(row[index] ?? ''))]);
export const DASHBOARD_DATE_HEADER = 'อัปเดตสถานะล่าสุด';
export function dashboardData(values = []) {
  const headers = (values[0] || []).map(String);
  for (const name of ['ผลตรวจ Apps Script', 'สถานะการเทียบ', 'เลขครุภัณฑ์ Apps Script'])
    if (!headers.includes(name))
      throw Object.assign(new Error(`Appscriptdata: ไม่พบคอลัมน์ ${name}`), { status: 422 });
  const records = values.slice(1).flatMap((row, index) => {
    const get = (name) => String(row[headers.indexOf(name)] ?? '').trim();
    if (!get('เลขครุภัณฑ์ Apps Script')) return [];
    const status = get('ผลตรวจ Apps Script');
    return [
      {
        row: index + 2,
        revision: revision(headers, row),
        updatedAt: get(DASHBOARD_DATE_HEADER),
        asset: get('เลขครุภัณฑ์ Apps Script'),
        name: get('ชื่ออุปกรณ์ Apps Script'),
        serial: get('S/N Apps Script'),
        inspection: [
          'ดี',
          'ชำรุด',
          'หาไม่เจอ',
          'ยังไม่ตรวจ',
          'อุปกรอื่นๆ',
          'กล้องวงจรปิด',
        ].includes(status)
          ? status
          : 'ไม่ระบุ',
        comparison: get('สถานะการเทียบ') || 'ไม่ระบุ',
        owner: get('ชื่อผู้ถือครอง'),
        team: get('ทีม'),
        notes: get('หมายเหตุการเทียบข้อมูล'),
        editableNotes: String(row[headers.indexOf('หมายเหตุ')] ?? ''),
        values: headers.map((_, i) => String(row[i] ?? '')),
      },
    ];
  });
  const inspection = {
      ดี: 0,
      ชำรุด: 0,
      หาไม่เจอ: 0,
      ยังไม่ตรวจ: 0,
      อุปกรอื่นๆ: 0,
      กล้องวงจรปิด: 0,
      ไม่ระบุ: 0,
    },
    comparison = {};
  for (const sourceRecord of records) {
    inspection[sourceRecord.inspection]++;
    comparison[sourceRecord.comparison] = (comparison[sourceRecord.comparison] || 0) + 1;
  }
  const total = records.length,
    completed =
      inspection['ดี'] +
      inspection['ชำรุด'] +
      inspection['หาไม่เจอ'] +
      inspection['อุปกรอื่นๆ'] +
      inspection['กล้องวงจรปิด'];
  return {
    headers,
    teams: [...new Set(records.map((sourceRecord) => sourceRecord.team).filter(Boolean))].sort(
      (a, requestData) => a.localeCompare(requestData, 'th'),
    ),
    records,
    total,
    completed,
    percent: total ? Math.round((completed / total) * 10000) / 100 : 0,
    inspection,
    comparison,
    loadedAt: new Date().toISOString(),
  };
}
