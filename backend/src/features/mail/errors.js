export function mailErrorMessage(error) {
  const message = error?.message || '';
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
  };
  return (
    reasons[error?.code] ||
    'ตรวจการตั้งค่า SMTP และสิทธิ์อ่านชีต (รายละเอียดจากเซิร์ฟเวอร์ถูกซ่อนเพื่อป้องกันข้อมูลลับ)'
  );
}
