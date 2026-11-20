export async function sendRequestNotification(
  ledger,
  kind,
  result,
  {
    env = process.env,
    fetcher = fetch,
    report = () => process.stderr.write('Google Chat notification failed\n'),
  } = {},
) {
  const webhook = env.GOOGLE_CHAT_WEBHOOK_URL?.trim();
  if (!webhook || result.unchanged) return 'skipped';
  try {
    const url = new URL(webhook);
    if (
      url.origin !== 'https://chat.googleapis.com' ||
      !/^\/v1\/spaces\/[^/]+\/messages$/.test(url.pathname) ||
      url.username ||
      url.password ||
      !url.searchParams.get('key') ||
      !url.searchParams.get('token')
    )
      throw new Error('Invalid Google Chat webhook');
    const returning = kind === 'คืน';
    const state = await ledger.readLedger();
    const rows = (returning ? state.returns : state.loans).filter((row) => row[0] === result.id);
    if (rows.length !== 1) throw new Error('Saved request not found');
    const row = rows[0];
    const text = [
      `[IQI Asset] มีคำขอ${kind}ใหม่`,
      `เลขคำขอ: ${row[0]}`,
      `ผู้ขอ: ${row[returning ? 4 : 3]}`,
      `ทีม: ${row[returning ? 5 : 4]}`,
      `อุปกรณ์: ${row[returning ? 10 : 9] || row[returning ? 7 : 6]}`,
      `เลขครุภัณฑ์: ${row[returning ? 8 : 7]}`,
      `S/N: ${row[returning ? 9 : 8] || '-'}`,
      `${returning ? 'วันที่คืน' : 'วันที่ยืม'}: ${row[11]}`,
      ...(!returning ? [`กำหนดคืน: ${row[12]}`] : []),
      'ตรวจสอบได้ที่เมนูอนุมัติคำขอในระบบ IQI Asset',
    ].join('\n');
    const response = await fetcher(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Google Chat rejected notification');
    return 'sent';
  } catch {
    // Never log the webhook URL or transport errors containing its credentials.
    report();
    return 'failed';
  }
}
