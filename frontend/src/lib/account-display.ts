export function formatAccountTimestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
      }).format(date)
    : '—';
}
export function formatAccountActivity(value: string | undefined, now = Date.now()) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'ยังไม่มีข้อมูล';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `เมื่อ ${minutes} นาทีที่แล้ว`;
  if (minutes < 1440) return `เมื่อ ${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  return `เมื่อ ${Math.floor(minutes / 1440)} วันที่แล้ว`;
}
export function readableAuditData(value: string) {
  if (!value) return 'ไม่มีข้อมูล';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
