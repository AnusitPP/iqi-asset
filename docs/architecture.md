# โครงสร้างโปรเจกต์

## จุดเริ่มต้น

- `frontend/public/js/app.js`: ประกอบฟีเจอร์และกำหนด callbacks ระหว่างกัน ไม่มีโค้ดสร้างฟอร์มหรือ API fetch เอง
- `backend/src/runtime.js`: สร้าง adapter, state และบริการหลัก
- `backend/src/http/app.js`: ประกอบ middleware และลงทะเบียน routes ของแต่ละฟีเจอร์

## โฟลเดอร์หลัก

```text
backend/src/
  core/
    config/       ค่าตั้งค่าและ credentials
    errors/       ข้อผิดพลาดที่ส่งให้ผู้ใช้และการ log แบบซ่อนข้อมูลลับ
    http/         host, security headers, CSRF และ request middleware
    lending/      ledger, schema และคิวเขียนร่วมของยืมกับคืน
    network/      network addresses
    security/     tokens และ fingerprint
    state/        local state และ write lock
    validation/   ตัวตรวจค่าและวันที่
  features/
    auth/         session middleware
    catalog/      อ่าน/แปลงรายการพร้อมยืม
    dashboard/    สรุปข้อมูลและแก้ผลตรวจ/รายละเอียด
    loans/        ส่งคำร้องยืม
    returns/      ส่งคำร้องคืน
    photos/       จัดเก็บและอ่านรูป
    records/      ค้นหา/แก้ทะเบียนเดิม
    review/       คิวรอตรวจและผลตรวจทะเบียน
  integrations/google/  Google Sheets และ Google Drive IO

frontend/public/js/
  app.js
  core/
    browser/      clipboard
    components/   icons, toast และช่องค้นหา catalog ที่ใช้ร่วมกัน
    dom/          สร้าง element/button และหา element
    forms/        controller ฟอร์มที่ใช้ร่วมระหว่างยืมกับคืน
    functions/    debounce
    http/         API client, response parser และสถานะเชื่อมต่อ
    navigation/   sidebar/menu และการสลับหน้า
  features/
    auth/         popup login/logout
    search/       ค้นหาและแสดงทะเบียน
    recordDetails/  รายละเอียด/แก้ข้อมูลทะเบียน
    review/       popup บันทึกผลตรวจ
    dashboard/    รายการ ตัวกรอง และรายละเอียด dashboard
    photos/       เตรียมไฟล์รูปและส่วนอัปโหลดรูป
    loans/        จุดเริ่มต้นฟอร์มยืม
    returns/      จุดเริ่มต้นฟอร์มคืน

shared/
  core/
    constants/    ข้อความที่ใช้ร่วมกัน
    extensions/dates.js  วันที่และเวลา Bangkok
    formatters/   ป้ายข้อความแสดงผล
  features/
    catalog/      แปลงชีต จับคู่คำค้น และประเภทอุปกรณ์
    lending/      ทีม ประเภท เงื่อนไข และสถานะยืมคืน
    photos/       photo slots
    records/      search status constants
```

## หลักการเพิ่มหรือแก้โค้ด

1. โค้ดเฉพาะฟีเจอร์อยู่ใน `features/<feature>/` และไฟล์บอกหน้าที่ เช่น `routes.js`, `service.js`, `details.js`
2. ของที่ใช้หลายฟีเจอร์ให้อยู่ core ที่เหมาะสม; โค้ดใช้ทั้ง Node และ browser ให้อยู่ `shared/core/` หรือ `shared/features/` ตามขอบเขต
3. Import จากไฟล์เจ้าของ implementation โดยตรง ไม่มีการคัดลอก helper ไปแต่ละฟีเจอร์
4. ชื่อ state บอกความหมาย เช่น `loadGeneration`, `dashboardData`, `requestData`, `readAvailableAssets`, `resolveCatalogSelection`
5. ข้อความร่วมอยู่ `shared/core/constants/messages.js`; ข้อความเฉพาะฟีเจอร์อยู่ `messages.js` ของฟีเจอร์ ไม่บังคับแยกข้อความที่ปรากฏเพียงจุดเดียวให้เป็น global
6. วันที่ต้องเรียกจาก `shared/core/extensions/dates.js`; ไม่แก้ `Date.prototype` และไม่สร้าง Intl formatter ซ้ำใน feature
7. ความต่างของ format เดิมคงไว้เป็นฟังก์ชันระบุชื่อ: วันที่ตรวจ, timestamp, display timestamp และ serial date ของ Sheets
8. ยืมกับคืนใช้ `LendingLedger` instance เดียวกันเพื่อรักษาคิวเขียนและ idempotency เดิม
9. เก็บข้อมูลลับใน `.env`/`credentials` เท่านั้น ไม่ import ไป browser

## การตรวจสอบ

- `npm test` — ทดสอบพฤติกรรม รวม timezone และความครบถ้วนของ imports
- `npm run check` — ตรวจ syntax จุดเริ่มต้น
- `npm run lint` — ตรวจทุกโมดูล
- `npm run build` — คัดลอก frontend และ shared ไป frontend/dist

สคริปต์เดิมใน `scripts/` เป็นเครื่องมือดูแล/ย้ายข้อมูลแบบเรียกเอง มีการปรับ imports ให้ตรงโครงสร้างใหม่ แต่ไม่ถูกเรียกจาก runtime และไม่รันระหว่าง refactor เพราะบางตัวแก้ข้อมูลจริง

## โค้ดที่นำออก

- ตัวเลือกยืมรุ่นเก่า `loanSearch.js` ที่ไม่มี caller หลังใช้ catalog search
- วิธีบันทึกแบบ `borrow()` / `returnItems()` รุ่นเก่าที่ไม่มี API/UI เรียกใช้แล้ว โดยคงคำร้อง `LoanRequestService.submit()` และ `ReturnRequestService.submit()` ที่ใช้งานจริง
- helper DOM/วันที่/throw error ที่คัดลอกซ้ำ ย้าย implementation ไป core แล้วให้ callers import

ไม่มีการเปลี่ยน schema ของชีตหรือเพิ่ม dependency ในการจัดโครงสร้างครั้งนี้
