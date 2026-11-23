import { expect, it } from 'vitest';
import { isElectronicEquipment } from '../src/features/porddatabase/electronics';

it.each([
  'คอมพิวเตอร์ NOTEBOOK ACER',
  'Samsung Monotor LED 24 นิ้ว',
  'Cisco Access Point',
  'เครื่องสำรองไฟ USP 1000VA',
  'LOGITECH Keyborad',
  'เครื่ื่องอ่านฮาร์ดดิส/ORICO',
  'กล้องวงจรปิด CCTV',
  'ไมโครโฟนชุดประชุม',
  'เครื่องวัดระยะด้วยเลเซอร์',
  'LOGITECH SPOTLIGHT PRESENTATION REMOTE',
  'JABRA SPEAK 510 MS BLUETOOTH',
])('includes electronic equipment: %s', (name) => expect(isElectronicEquipment(name)).toBe(true));

it.each([
  '',
  'โต๊ะทำงาน',
  'เก้าอี้สำนักงาน',
  'ตู้เอกสารเหล็ก',
  'ม่านม้วน',
  'ตู้เย็น',
  'ไมโครเวฟ',
  'เครื่องปรับอากาศ',
  'เครื่องฟอกอากาศ',
  'ปั๊มน้ำ',
  'ขาตั้งกล้อง',
  'ขาตั้งรองรับจอ',
  'ตู้จัดเก็บอุปกรณ์ RACK',
  'โปรแกรม Adobe Photoshop',
])('keeps other items outside the shortlist: %s', (name) =>
  expect(isElectronicEquipment(name)).toBe(false),
);
