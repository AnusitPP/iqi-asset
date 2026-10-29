# แผนปรับโครงสร้างตามฟีเจอร์

29 ตุลาคม 2026 — ขอบเขต: จัดโมดูลและชื่อโดยรักษา API, ข้อมูลชีต, การตรวจสิทธิ์ และพฤติกรรม UI เดิม

- [x] เก็บผลทดสอบก่อนเปลี่ยนและแผนที่ imports
- [x] shared/core: dates, errors, ค่าคงที่กลาง; shared/features: constants/ตัวแปลงเฉพาะฟีเจอร์
- [x] backend/core: config, security, state, network, HTTP; backend/features: records, dashboard, photos, review, loans, returns, catalog
- [x] แยก routes จาก HTTP bootstrap, แยกยืม/คืนจาก ledger ที่ใช้ร่วมกัน และแยก Google Drive/เตรียมรูปออกจากบริการ photos
- [x] frontend/core: DOM, API client, components, navigation; frontend/features: auth, search, record details, review inspection, dashboard, photos, loans, returns, catalog
- [x] app.js เหลือประกอบฟีเจอร์; แยก modal รูปและรายละเอียดออกจาก dashboard
- [x] ย้าย date format ไป shared/core/extensions/dates.js โดยคงรูปแบบเดิมแต่ละบริบทและ timezone Bangkok ไม่แก้ Date.prototype
- [x] เปลี่ยนชื่อ state/function ที่กำกวมในส่วนที่แยก, ย้ายข้อความสถานะร่วมและค่าคงที่ไปโมดูลเจ้าของ
- [x] ลบ loanSearch และวิธีบันทึกรุ่นเก่าที่ไม่มี production caller; เก็บสคริปต์ migration เก่าไว้เป็นประวัติและไม่รัน
- [x] ปรับ imports, scripts, tests, เอกสาร และเพิ่มตรวจ import graph/วันที่
- [x] รัน tests, syntax, lint, build และตรวจ localhost โดยไม่เขียนข้อมูลจริง

ไม่เพิ่ม dependency; ไม่แก้ schema ชีต; ไม่ push หรือ merge ในงานนี้

ผลตรวจ: UI เข้าสู่ระบบ, dashboard/details/photos, ค้นหาทะเบียน, รายละเอียดทะเบียน และค้นหา/เติมเลขในยืมและคืนทำงานผ่าน localhost; ไม่ส่งคำร้องหรือแก้ข้อมูลจริงในการตรวจโครงสร้าง
