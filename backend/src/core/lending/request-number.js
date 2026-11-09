import { randomInt } from 'node:crypto';

export function createRequestNumber(kind, records, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const prefix = `STeP-IQI-${kind}${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const id = `${prefix}-${suffix}`;
    if (!records.some((row) => row[0] === id)) return id;
  }
  throw Object.assign(new Error('สร้างเลขคำขอไม่สำเร็จ กรุณาลองใหม่'), { status: 503 });
}
