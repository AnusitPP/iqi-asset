// Name-based shortlist for review; it does not change the source or select records.
export function isElectronicEquipment(name: string) {
  if (/ขาตั้ง|ตู้จัดเก็บ|โปรแกรม|software/i.test(name)) return false;
  return /คอมพิวเตอร์|คอมพิเตอร์|notebook|laptop|\bpc\b|จอมอนิเตอร์|monit(?:or|er|or)|monotor|กล้อง|camera|qcam|qcan|ไมโครโฟน|มิกเซอร์|ลำโพง|เครื่องเสียง|สัญญาณเสียง|โทรศัพท์|โทรทัศน์|ทีวี|\btv\b|เครื่องพิมพ์|เครื่องปริ้นท์|laser\s*jet|laserjet|projector|เครื่องฉายภาพ|เครื่อง(?:อัด|บันทึก)เสียง|เครื่องทาบบัตร|เครื่องสำรองไฟ|\bups\b|\bssd\b|\bhdd\b|harddisk|ฮาร์ดดิส|เครื่องอ่าน|เครื่ื่องอ่าน|switch|access point|router|เครือข่าย|กระจายสัญญาณ|แยก.*สัญญาณ|สลับสัญญาณ|แยกจอภาพ|ตัวรับสัญญาณ|ส่งภาพและเสียง|keybo(?:ard|rad)|keyboard|เมาส์|mouse|present(?:er|ation|ion)|laser pointer|เลเซอร์|วัดระดับดิจิตอล|\bbattery\b|\bbluetooth\b/i.test(
    name,
  );
}
