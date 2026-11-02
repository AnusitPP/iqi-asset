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
export function readableAuditData(value: string) {
  if (!value) return 'ไม่มีข้อมูล';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
