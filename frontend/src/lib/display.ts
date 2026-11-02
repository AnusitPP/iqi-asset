export function formatAssetFieldValue(header: string, value: string) {
  return header.trim() === 'ทีม' ? value.replace(/^\s*\d+\s*\.\s*/, '') : value;
}
export function formatBangkokDateInBuddhistEra(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const getDatePartValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${getDatePartValue('day')}/${getDatePartValue('month')}/${Number(getDatePartValue('year')) + 543}`;
}
export function updateInspectionDateInNote(value: string, date: string) {
  const pattern =
    /(วันที่ตรวจ(?:สอบ|เช็ค|เช็ก)?\s*[:：]?\s*)\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}/gu;
  return pattern.test(value)
    ? value.replace(pattern, (_match: string, prefix: string) => prefix + date)
    : `${value.trim()}${value.trim() ? '\n' : ''}วันที่ตรวจสอบ ${date}`;
}
function parseInspectionDate(value: string) {
  const text = value.trim().replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 3664));
  const local = text.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!local && !iso) return null;
  const day = Number(local?.[1] ?? iso?.[3]),
    month = Number(local?.[2] ?? iso?.[2]);
  let year = Number(local?.[3] ?? iso?.[1]);
  if (year >= 2400) year -= 543;
  const stamp = Date.UTC(year, month - 1, day),
    date = new Date(stamp);
  if (
    year < 1900 ||
    year > 2200 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return {
    stamp,
    label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`,
  };
}
export function calculateInspectionAgeInDays(
  value: string,
  now = formatBangkokDateInBuddhistEra(),
) {
  const checked = parseInspectionDate(value),
    today = parseInspectionDate(now);
  return checked && today
    ? { date: checked.label, days: Math.round((today.stamp - checked.stamp) / 86400000) }
    : null;
}
export function preserveUnchangedAssetValues(
  original: string[],
  baseline: string[],
  current: string[],
) {
  return current.map((value, index) =>
    value === baseline[index] ? (original[index] ?? '') : value,
  );
}
export function getStatusColorClass(status: string) {
  return (
    (
      {
        ดี: 'good',
        ชำรุด: 'damaged',
        หาไม่เจอ: 'lost',
        ยังไม่ตรวจ: 'todo',
        อุปกรอื่นๆ: 'other',
        กล้องวงจรปิด: 'cctv',
        ตรงกัน: 'good',
        ข้อมูลไม่ตรง: 'damaged',
      } as Record<string, string>
    )[status] ?? 'todo'
  );
}
