# บันทึกยืม–คืนบน Vercel ผ่าน Apps Script

โครงสร้าง: Browser → Vercel (ตรวจ session/สิทธิ์) → Apps Script Web App (ตรวจ HMAC + ScriptLock) → Google Sheets

ไม่มี Redis และไม่มี dependency ใหม่ ตัวอ่านข้อมูลและระบบอีเมลยังอยู่ Vercel ตามเดิม

## เตรียม Apps Script

1. ใช้บัญชีองค์กรที่มีสิทธิ์แก้ไฟล์ Google Sheets สร้าง Apps Script **หนึ่งโปรเจกต์** สำหรับ production
2. รัน `npm run build:lending-script` ใน repo เพื่อสร้าง `apps-script/lending/Shared.gs` จาก schema/ตัวเลือกเดิม
3. ใส่ `Code.gs` และ `Shared.gs` จาก `apps-script/lending/` ลงโปรเจกต์ Apps Script
4. Settings → Show appsscript.json manifest file แล้วใส่ manifest จากโฟลเดอร์เดียวกัน เปิด Advanced Google Service **Google Sheets API v4** (ชื่อ `Sheets`) ด้วย manifest หรือเมนู Services หากใช้ standard Cloud project ให้เปิด Google Sheets API ใน Cloud Console ด้วย
5. ตั้ง Script Properties:
   - `GOOGLE_SPREADSHEET_ID`: ไฟล์ข้อมูลครุภัณฑ์เดิม
   - `LENDING_SCRIPT_SECRET`: secret สุ่มยาวอย่างน้อย 32 ตัวอักษร ให้ใช้เฉพาะงานนี้ ไม่ใช้ APP_SECRET ซ้ำ
6. ชีตต้องมี `พร้อมยืม`, `รายการยืมครุภัณฑ์`, `รายการคืนครุภัณฑ์` พร้อมหัวคอลัมน์เดิม ชีตยืมรองรับคอลัมน์ `email` ตามระบบอีเมลเดิม
7. Deploy เป็น Web App: execute as บัญชีที่ deploy และ access ให้ backend เรียกได้โดยไม่ต้อง Google sign-in (มักเป็น Anyone) ต้องได้รับอนุญาตตามนโยบายองค์กร ปลายทางตรวจ HMAC ก่อนเปิดชีตหรือขอล็อกเสมอ ห้ามส่ง secret ให้ browser
8. เก็บ URL `/exec` ของ deployment ไม่ใช้ URL editor หรือ `/dev`

Apps Script และ Vercel ต้องใช้ secret เดียวกัน และไม่ควรมี deployment เก่าที่รันโค้ดต่างเวอร์ชันรับงานพร้อมกัน

## Vercel / localhost

ตั้ง Environment Variables เฉพาะ server:

```dotenv
LENDING_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
LENDING_SCRIPT_SECRET=<secret เดียวกับ Script Properties>
```

กำหนดทั้งคู่เมื่อจะใช้ gateway บน localhost หรือ hosted server แล้ว restart/redeploy คง Google credentials, login, Drive และ SMTP เดิมไว้เพราะงานอ่าน/อีเมลยังใช้บริการเดิม

หากไม่กำหนดทั้งสองค่า localhost จะใช้คิวในเครื่องเดิม ส่วน hosted server ยังปิดการเขียนด้วย 503 อย่างปลอดภัย ไม่ได้ปลดล็อก hosted แบบไม่มีตัวป้องกัน

## ก่อนเปิดใช้งาน

- ทดสอบบนสำเนาชีตและ Apps Script แยกจาก production ก่อน (ทั้ง preview และ local ที่ใช้ชีตเดียวกันต้องชี้ **script project เดียวกัน**)
- หยุด backend/สคริปต์เก่าที่เขียนชีตยืม–คืนโดยตรง ทุกการยืม คืน และอนุมัติต้องเข้าทางนี้ การแก้ชีตเองหรือโปรเจกต์ Apps Script คนละตัวไม่ได้อยู่ในล็อกเดียวกัน
- ตรวจสิทธิ์ผู้ยืม/แอดมิน, ยืมอุปกรณ์เดียวกันสองคำขอ, ส่ง requestId เดิมซ้ำ, คืนซ้ำ, รายการชำรุด, กดย้อนสถานะเสร็จสิ้น, เปลี่ยนสถานะจากหน้าที่เปิดค้างไว้
- คำขออนุมัติส่ง `expectedStatus` เพื่อปฏิเสธข้อมูลหน้าจอที่เก่า ก่อน deploy ควรให้ผู้ใช้โหลดหน้าใหม่
- ทดสอบอีเมลและ AuditLogs หลังบันทึกเสร็จ ซึ่งเป็นขั้นตอนแยกหลัง transaction ของชีตยืม–คืน

## ข้อจำกัดและการแก้ปัญหา

- `ScriptLock` ป้องกันการเขียนชนกันระหว่าง execution **ในโปรเจกต์สคริปต์เดียวกัน** ไม่ได้ล็อกผู้แก้ชีตด้วยมือ
- การคืน/อนุมัติคืนใช้ Google Sheets `batchUpdate` ครั้งเดียวเพื่อเขียนสถานะที่เชื่อมกันแบบ atomic ภายใน spreadsheet เดียว
- Gateway ไม่ retry คำสั่งเขียนอัตโนมัติ หากตอบกลับไม่สำเร็จให้ส่งคำขอเดิมซ้ำ (requestId เดิม) ระบบตรวจแถวที่เคยบันทึกก่อนตรวจของว่าง
- รอล็อกสูงสุด 20 วินาที, gateway รอ 45 วินาที หากมี timeout การทำงานฝั่ง Google อาจดำเนินต่อ ให้โหลดรายการล่าสุดก่อนลองคำขอเดิม
- Apps Script และ Google Sheets ยังมี quota วิธีนี้ไม่ได้กำจัด HTTP 429 จากการอ่านชีต/session ที่ Vercel ใช้อยู่
- 502 รูปแบบตอบกลับไม่ถูกต้อง: ตรวจ URL `/exec`, deployment version และการเข้าถึงโดยไม่ต้อง Google sign-in
- 401: secret ไม่ตรง/คำขอหมดอายุ; 409: อุปกรณ์ไม่ว่าง/คืนซ้ำ/สถานะเปลี่ยน; 503: ล็อกไม่ว่างหรือยังไม่ได้ตั้งค่า
- อย่าลบเงื่อนไข hosted ใน `withWriteLock()` เพื่อแก้ 503 ให้ตั้ง gateway ให้ถูกต้องแทน

## ตรวจในเครื่อง

```sh
npm run build:lending-script
node --test test/backend/lendingScript.test.js
npm run typecheck:web
```

ชุดทดสอบจำลอง Apps Script และ Sheets เพื่อตรวจลายเซ็น การล็อก คำขอซ้ำ และ batch writes ไม่ใช่การยืนยัน deployment จริงบน Google
