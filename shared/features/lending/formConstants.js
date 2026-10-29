export const FORM_TEAMS = [
  'คณะผู้บริหาร',
  'GA',
  'AFP',
  'IASA',
  'QS',
  'NMCO',
  'HD',
  'PITI',
  'Tech Spin',
  'PubSec',
  'Tech Up',
  'EIC',
  'ISI',
  'CRM',
  'IFU',
  'IQI',
  'LES',
  'FOODFABR',
  'CC',
  'IMO',
  'SIT',
  'MI',
  'LINC',
];
export const LOAN_TYPES = [
  'คอมพิวเตอร์พกพา (Laptop Computer)',
  'คอมพิวเตอร์ตั้งโต๊ะ (Desktop Computer)',
  'เครื่องพิมพ์เอกสาร (Printer)',
  'หน้าจอ (Monitor)',
  'เมาส์ (Mouse)',
  'คีย์บอร์ด (Keyboard)',
  'สาย Connector เช่น HDMI, VGA',
  'USB WI-FI',
  'Flash Drive',
  'อื่นๆ',
];
export const RETURN_TYPES = [...LOAN_TYPES.slice(0, 8), 'ตัวเลือก 9', 'อื่นๆ'];
export const LOAN_TERMS =
  'ผู้ยืมจะสามารถยืมครุภัณฑ์หรือวัสดุได้ไม่เกิน 7 วัน โดยต้องระบุเหตุผลการยืม และกำหนดวันส่งคืนทุกครั้ง';
export const LOAN_NOTES = [
  'กรณีมีตำหนิ ชำรุดก่อนการยืม ควรระบุเป็นหมายเหตุไว้ในหลักฐานการยืม',
  'กรณียืมใช้ภายในสถานที่ของหน่วยงาน จะต้องได้รับอนุมัติ จากหัวหน้าหน่วยงานซึ่งรับผิดชอบพัสดุนั้น',
];
export const RETURN_TERMS =
  'กรณีพัสดุมีตำหนิ หรือชำรุด ระหว่างการยืม หรือถือครอง พนักงานจะต้องเป็นผู้รับผิดชอบค่าซ่อม หรือชดเชยพัสดุเองทั้งหมด';
