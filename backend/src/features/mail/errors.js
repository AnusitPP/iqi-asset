export function mailErrorMessage(error) {
  const message = error?.message || '';
  // Match known provider errors, but never echo its raw response (addresses/keys may be present).
  const providerMessage = `${message}\n${typeof error?.response === 'string' ? error.response : ''}`;
  if (/only send testing emails|only send.*own email address/i.test(providerMessage))
    return 'Resend อนุญาตให้ผู้ส่ง onboarding@resend.dev ส่งทดสอบถึงอีเมลที่ใช้สมัคร Resend เท่านั้น หากจะส่งให้ผู้อื่นต้องยืนยันโดเมนผู้ส่งก่อน';
  if (
    /domain[^\n]{0,160}(?:not verified|not been verified)|domain not verified/i.test(
      providerMessage,
    )
  )
    return 'Resend ยังไม่ยืนยันโดเมนผู้ส่ง กรุณาตรวจ Resend > Domains และใช้ MAIL_FROM จากโดเมนที่ Verified แล้ว';
  // Only our own fixed configuration messages are safe to display verbatim.
  if (
    /^กรุณาตั้งค่า (?:SMTP_HOST|SMTP_USER|SMTP_PASS|MAIL_FROM)(?:, (?:SMTP_HOST|SMTP_USER|SMTP_PASS|MAIL_FROM))*$/.test(
      message,
    ) ||
    ['SMTP_PORT ไม่ถูกต้อง', 'MAIL_FROM ต้องเป็นอีเมลที่ถูกต้อง', 'อีเมลผู้รับไม่ถูกต้อง'].includes(
      message,
    )
  )
    return message;
  const reasons = {
    EMAIL_SOURCE:
      'ข้อมูลชีตผู้รับไม่ถูกต้อง ตรวจ MAIL_REMINDER_SHEET, MAIL_REMINDER_ID_HEADER, MAIL_REMINDER_EMAIL_HEADER และค่ารหัสรายการ/อีเมลที่ซ้ำหรือไม่ถูกต้อง',
    EMAIL_PARTIAL: 'มีบางอีเมลส่งไม่สำเร็จ บางคนอาจได้รับแล้ว กรุณาตรวจสอบก่อนส่งซ้ำ',
    EAUTH:
      'SMTP ล็อกอินไม่ผ่าน ตรวจ SMTP_USER/SMTP_PASS และวิธี authentication ที่ผู้ให้บริการอนุญาต',
    ENOAUTH: 'SMTP ไม่มีข้อมูลยืนยันตัวตน ตรวจ SMTP_USER/SMTP_PASS',
    EDNS: 'หา SMTP_HOST ไม่พบ ตรวจชื่อ host และ DNS',
    ENOTFOUND: 'หา SMTP_HOST ไม่พบ ตรวจชื่อ host และ DNS',
    ETIMEDOUT: 'เชื่อมต่อ SMTP หมดเวลา ตรวจ SMTP_HOST/SMTP_PORT และ firewall',
    ECONNREFUSED: 'SMTP ปฏิเสธการเชื่อมต่อ ตรวจ host และ port',
    ESOCKET: 'การเชื่อมต่อ SMTP มีปัญหา ตรวจ host, port, TLS และเครือข่าย',
    ETLS: 'SMTP เชื่อมต่อ TLS ไม่สำเร็จ ตรวจ port และ certificate ของเซิร์ฟเวอร์',
    EENVELOPE:
      'SMTP ปฏิเสธผู้ส่งหรือผู้รับ ตรวจ MAIL_FROM และข้อจำกัดผู้รับในหน้ารายการส่งของผู้ให้บริการ',
    EMESSAGE: 'SMTP ปฏิเสธข้อความ ตรวจเหตุผลในหน้ารายการส่งของผู้ให้บริการ เช่น Resend > Emails',
    ECONNECTION: 'การเชื่อมต่อ SMTP ถูกตัด ตรวจเครือข่ายและสถานะผู้ให้บริการก่อนส่งซ้ำ',
  };
  return (
    reasons[error?.code] ||
    'ตรวจการตั้งค่า SMTP และสิทธิ์อ่านชีต (รายละเอียดจากเซิร์ฟเวอร์ถูกซ่อนเพื่อป้องกันข้อมูลลับ)'
  );
}

export function mailErrorDiagnostic(error) {
  const knownCodes = [
    'EAUTH',
    'ENOAUTH',
    'EDNS',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ESOCKET',
    'ETLS',
    'EENVELOPE',
    'EMESSAGE',
    'ECONNECTION',
  ];
  const code = knownCodes.includes(error?.code) ? error.code : undefined;
  const smtpStatus =
    Number.isInteger(error?.responseCode) && error.responseCode >= 400 && error.responseCode <= 599
      ? error.responseCode
      : undefined;
  return { ...(code ? { code } : {}), ...(smtpStatus ? { smtpStatus } : {}) };
}
