# IQI Asset Checker

เว็บจัดการคำขอยืม–คืนครุภัณฑ์ ใช้ Node.js 22.12+, Next.js + TypeScript, Express และ Google Sheets API โดยไม่มี database เพิ่มเติม

## โครงสร้างโค้ด

ดู [คู่มือโครงสร้างและจุดเริ่มต้นแต่ละฟีเจอร์](docs/architecture.md) — แยก backend/frontend เป็น `core` กับ `features` และใช้ฟังก์ชันวันที่ร่วมกันจาก `shared/core/extensions/dates.js`

## เปิดใช้งาน

Git hook ที่ [.githooks/pre-push](.githooks/pre-push) จะรัน `npm run lint`,
`npm run lint:web`, `npm test` และ `npm run test:web` ก่อน push ทุกครั้ง
ถ้าคำสั่งใดไม่ผ่านจะหยุด push โดยไม่แก้ไฟล์ให้อัตโนมัติ
เมื่อตั้งค่า clone ใหม่ ให้รัน `git config core.hooksPath .githooks` หนึ่งครั้ง
และรันตรวจด้วยตัวเองได้ด้วย `sh .githooks/pre-push`

```powershell
npm install
# ครั้งแรกเท่านั้น ถ้ายังไม่มี .env:
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
npm run dev:api
# อีก terminal
npm run dev
```

เปิด http://localhost:3001 และเข้าสู่ระบบด้วย Google ตั้ง `APP_URL=http://localhost:3000` และ `FRONTEND_URL=http://localhost:3001` ใน root `.env` และลงทะเบียน callback `http://localhost:3000/api/auth/google/callback` ใน Google OAuth client โดยเก็บค่า credentials/Sheet IDs เดิมไว้ Express API รันที่ :3000 ส่วน Next.js รันที่ :3001

วาง Service Account ที่ `credentials/service-account.json` และแชร์ Google Spreadsheet ให้บัญชีนั้นเป็น Editor พร้อมเปิด Google Sheets API ใน Google Cloud ตัว credential และ `.env` ถูก ignore และไม่ได้อยู่ใน frontend/public/

ไฟล์ต้องเป็น **Google Sheets จริง** ถ้าเป็น Excel ให้เปิดแล้วเลือก File → Save as Google Sheets จากนั้นนำ ID ใหม่มาใส่ `.env` เซิร์ฟเวอร์จะแสดงข้อผิดพลาดที่อ่านได้ถ้าเชื่อมไม่ได้ และหน้าเว็บกดค้นหาเพื่อลองใหม่ได้

## ชีตที่ใช้งาน

ระบบตรวจเฉพาะ `พร้อมยืม`, `รายการยืมครุภัณฑ์` และ `รายการคืนครุภัณฑ์` ใน workbook ครุภัณฑ์ ส่วนบัญชีผู้ใช้และบุคลากรใช้ workbook ที่ตั้งค่าแยกไว้ตามเดิม

ไม่ใช้ `SHEET_IQI`, `SHEET_ALL_ITEMS`, `SHEET_ALL` หรือ `IQI_DATE_*` แล้ว และไม่สร้างชีตตรวจครุภัณฑ์เดิมเมื่อเริ่มระบบ `npm run setup:sheets` ตรวจว่าชีตยืม–คืนที่ต้องใช้มีอยู่ โดยไม่แก้ไขข้อมูล

## วิธีใช้

ผู้ใช้ทุกบทบาทเริ่มที่ `/loans` โดย `/` ส่งต่อไป `/loans` ใช้ `/loans` ส่งคำขอยืม `/returns` ส่งคำขอคืน และ `/my-requests` ติดตามคำขอของตนเอง

## มือถือ / LAN

เซิร์ฟเวอร์ listen `0.0.0.0` และแสดง IPv4 ของเครื่องใน terminal มือถือกับคอมต้องอยู่ WiFi/LAN เดียวกัน แล้วเปิด `http://<IP ของคอม>:3000` เช่น `http://192.168.1.94:3000` IP อาจเปลี่ยนได้ ให้ดู terminal หลังเปิดแอป

Windows Firewall อาจถาม permission ให้ Allow บน **Private Network** หน้าเว็บใช้ Google Login และตรวจสิทธิ์แยกตามบัญชี ไม่มีการเข้าสู่ระบบด้วยรหัสผ่านร่วม Session เก็บในชีต Authentication อายุ 30 นาที ใช้ปุ่ม “ล็อกออก” เมื่อเลิกใช้งาน การเปิดผ่าน HTTP ใน LAN ไม่มีการเข้ารหัสการรับส่งข้อมูล

## การบันทึกและความปลอดภัย

API ตรวจ session สิทธิ์ผู้ใช้ CSRF และข้อมูลก่อนบันทึก การลบรูปยังสแกนแท็บที่มีอยู่จริงเพื่อป้องกันลบไฟล์ที่ถูกอ้างอิงซ้ำ โดยไม่บังคับว่าต้องมีชีตตรวจครุภัณฑ์เดิม

## ตรวจสอบ

```powershell
npm test
npm run check
npm run lint:web
npm run test:web
npm run build
npm run test:proxy
```

### ฟีเจอร์ตรวจครุภัณฑ์เดิม

ถอดหน้า `/assets`, `/dashboard` และ API เฉพาะออกแล้ว ข้อมูลชีตเดิมยังคงอยู่ ระบบยืม–คืนและรูปครุภัณฑ์ใน catalog ยังคงใช้งานได้

## อีเมลสรุปและ cron รายวัน

Google Chat: ตั้ง `GOOGLE_CHAT_WEBHOOK_URL` ใน `.env` ฝั่งเซิร์ฟเวอร์ และใน Vercel Environment Variables ก่อน deploy เพื่อแจ้งเฉพาะคำขอยืมใหม่และคำขอคืนใหม่ ไม่ส่งเมื่อเปลี่ยนสถานะหรือส่งคำขอเดิมซ้ำ ถ้าไม่ตั้งค่าจะไม่ส่ง Chat; การส่งล้มเหลวไม่ยกเลิกคำขอ (รอไม่เกิน 5 วินาทีต่อครั้ง และไม่ส่งซ้ำอัตโนมัติ) ห้ามใส่ URL ใน frontend หรือ commit ลง Git

Dev ในเครื่อง: ตั้ง `GOOGLE_CHAT_DEV_WEBHOOK_URL` เป็นห้องทดสอบ แล้วรีสตาร์ต API คำขอจาก localhost/127.0.0.1 จะส่งการ์ดเล็กหลังเปลี่ยนข้อมูลสำเร็จ (ยืม คืน ยกเลิก ปรับสถานะ เพิ่ม/ลบอุปกรณ์ รูป Dashboard ผลตรวจ และสิทธิ์ผู้ใช้) แทนการ์ดคำขอใหม่แบบเต็ม ไม่ส่งจากการเปิดหน้า ค้นหา ดูรูป ล็อกอิน หรือคำขอที่ล้มเหลว ไม่รวมรูปไบนารี รหัสผ่าน token และข้อมูล session การส่งทำหลัง HTTP response และไม่ทำให้การบันทึกล้มเหลว ฟังก์ชันนี้ปิดเสมอบน Vercel แม้ตั้งตัวแปรไว้

ข้อความ Chat ส่งเฉพาะการ์ด พร้อมข้อมูลผู้ขอ อุปกรณ์ เหตุผล/วัตถุประสงค์ และหมายเหตุ ใช้ไอคอนโน้ตบุ๊กที่มุมซ้ายบน ปุ่มเปิด `/approval-requests` บนเว็บตาม `GOOGLE_CHAT_APP_URL` (ถ้าไม่ตั้งใช้ `FRONTEND_URL` หรือ `APP_URL`) คำขอคืนใช้วัตถุประสงค์จากรายการยืมเดิม แสดงเฉพาะรูปแรกจากชีตพร้อมยืมผ่าน `/api/chat-photos/:id` โดยตรวจว่าไฟล์นั้นแชร์สาธารณะอยู่แล้วและอยู่ใน catalog ตัวแจ้งเตือนไม่เปลี่ยนสิทธิ์ไฟล์ รูปส่วนตัวจะไม่แสดง ต้อง deploy endpoint และไฟล์ไอคอนก่อนทดสอบรูปใน Chat จริง

เพิ่ม SMTP และคอลัมน์ `email` ข้างชื่อในชีตยืม ตาม [คู่มือส่งเมลรายวัน](docs/daily-mail.md)
ใช้ `npm run mail:preview` ดูเมลเตือนโดยไม่ส่ง, `npm run mail:verify` ตรวจ SMTP,
`npm run mail:send` ส่งหนึ่งรอบ
Vercel Cron เรียก `/api/cron/due-reminders` ทุกวันช่วง 08:00 เวลาไทย โดยตรวจ CRON_SECRET
ส่งแยกตาม email ในชีต เฉพาะรายการที่ยังไม่รับคืนและครบกำหนดในอีก 2 วัน ไม่ต้องเปิด worker ค้าง
ตั้ง SMTP และ CRON_SECRET ใน Vercel Production Environment Variables ก่อน deploy

## Vercel deployment

การเพิ่มครุภัณฑ์พร้อมรูปส่งข้อมูลและรูปที่เลือกทั้งหมดในคำขอเดียว (สูงสุด 3 รูป) เซิร์ฟเวอร์ตรวจและอัปโหลดรูปครบก่อนบันทึกแถวพร้อมลิงก์รูป ถ้าอัปโหลดล้มเหลวจะไม่สร้างรายการ และจะพยายามย้ายรูปที่อัปโหลดในครั้งนั้นไปถังขยะ หากผลตอบกลับจาก Sheets ขาดหาย ระบบจะตรวจรายการก่อนล้างรูปเพื่อไม่ลบรูปของรายการที่บันทึกสำเร็จแล้ว กรณียืนยันผลไม่ได้ให้โหลดรายการล่าสุดก่อนลองใหม่

Production ที่ใช้ My Drive ต้องตั้ง `GOOGLE_DRIVE_OAUTH_JSON` (ข้อมูลบัญชีเจ้าของ Drive รวม refresh token) และ `GOOGLE_PHOTO_FOLDER_ID` แล้ว deploy ใหม่; service account อย่างเดียวไม่สามารถอัปโหลดเข้า My Drive ได้

See [deployment instructions](docs/vercel-deployment.md) for environment variables, private JSON credentials, Google Login, Sheet-backed sessions, sheet preparation, verification and platform limits. Do not upload `.env` or `credentials/`.

## File structure

Backend, frontend, shared helpers and tests are separated by responsibility. See [project structure](docs/architecture.md). Run all npm commands from the project root; `npm run build` builds Next.js and its Express API adapter into `frontend/.next`. Set Vercel Root Directory to `frontend`, Framework to Next.js, and include source files outside root.

## Next.js frontend

See [frontend commands](frontend/README.md), [feature parity](docs/frontend-migration.md), and [Vercel settings](docs/vercel-deployment.md). Frontend checks: `npm run check`, `npm run lint:web`, `npm run test:web`, `npm run build`. HTTP smoke tests: `npm run test:embedded-api` and `npm run test:proxy`.
