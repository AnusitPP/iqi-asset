export async function readApiResponse(response) {
  const type = response.headers.get('content-type') || '';
  const suffix = ` (HTTP ${response.status})`;
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(type)) {
    if (response.status === 413) throw new Error('ไฟล์ใหญ่เกินขนาดที่เซิร์ฟเวอร์รับได้' + suffix);
    throw new Error(
      (response.ok ? 'เซิร์ฟเวอร์ส่งข้อมูลผิดรูปแบบ' : 'เซิร์ฟเวอร์ไม่พร้อมใช้งาน กรุณาลองใหม่') +
        suffix,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('เซิร์ฟเวอร์ส่ง JSON ไม่สมบูรณ์ กรุณาลองใหม่' + suffix);
  }
  if (!response.ok) {
    const message =
      data && typeof data.error === 'string' ? data.error : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
    throw new Error(message + suffix);
  }
  return data;
}
