import { createHmac } from 'node:crypto';

// Only the server signs commands; never expose this secret to the browser.
export function createLendingGateway(config, fetcher = fetch) {
  if (!config.lendingScriptUrl && !config.lendingScriptSecret) return null;
  const url = new URL(config.lendingScriptUrl || 'https://invalid.local');
  if (
    url.origin !== 'https://script.google.com' ||
    !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    !config.lendingScriptSecret ||
    config.lendingScriptSecret.length < 32
  )
    throw new Error('ตั้งค่า LENDING_SCRIPT_URL และ LENDING_SCRIPT_SECRET ไม่ถูกต้อง');
  return {
    async execute(action, body) {
      const payload = JSON.stringify({ version: 1, timestamp: Date.now(), action, body });
      const signature = createHmac('sha256', config.lendingScriptSecret)
        .update(payload)
        .digest('hex');
      let response;
      try {
        response = await fetcher(url.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, signature }),
          signal: AbortSignal.timeout(45_000),
        });
      } catch {
        throw Object.assign(new Error('ติดต่อระบบบันทึกไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้ง'), {
          status: 503,
          publicMessage: 'ติดต่อระบบบันทึกไม่สำเร็จ กรุณาลองคำขอเดิมอีกครั้ง',
        });
      }
      let result;
      try {
        result = await response.json();
      } catch {
        /* Deployment may require Google sign-in. */
      }
      if (!response.ok || !result || typeof result.ok !== 'boolean')
        throw Object.assign(
          new Error('Apps Script ไม่ตอบกลับตามรูปแบบ กรุณาตรวจ deployment และสิทธิ์เข้าถึง'),
          {
            status: 502,
            publicMessage: 'Apps Script ไม่ตอบกลับตามรูปแบบ กรุณาตรวจ deployment และสิทธิ์เข้าถึง',
          },
        );
      if (!result.ok) {
        const status = [400, 401, 403, 409, 422, 429, 503].includes(result.status)
          ? result.status
          : 502;
        throw Object.assign(new Error(result.error || 'บันทึกไม่สำเร็จ'), {
          status,
          publicMessage: result.error || 'บันทึกไม่สำเร็จ',
        });
      }
      if (typeof result.result?.id !== 'string')
        throw Object.assign(new Error('ผลการบันทึกไม่ถูกต้อง'), { status: 502 });
      return result.result;
    },
  };
}
