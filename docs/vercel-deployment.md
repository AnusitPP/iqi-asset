# Deploy Next.js และ Express API บน Vercel project เดียว

Frontend เป็น Next.js + TypeScript ใน `frontend/` ส่วน `backend/`, Google Sheets/Drive integrations และ Google Login ใช้ implementation ปัจจุบันผ่าน `frontend/src/pages/api/[[...path]].ts` → `api/index.js` ไม่มี API/business logic ชุดที่สอง

## Project settings

| Setting                                     | Value                                                         |
| ------------------------------------------- | ------------------------------------------------------------- |
| Root Directory                              | `frontend`                                                    |
| Framework Preset                            | Next.js                                                       |
| Install Command                             | `cd .. && npm ci` จาก `frontend/vercel.json`                  |
| Build Command                               | `npm run build` จาก `frontend/vercel.json`                    |
| Output Directory                            | `.next` ภายใน `frontend/`                                     |
| Include source files outside Root Directory | เปิด เพื่อรวม `backend/`, `api/`, `shared/` และ root lockfile |
| Node.js                                     | 22.x หรือใหม่กว่าที่ตรงกับ package engines                    |

ต้องตั้ง Root Directory ใน Vercel Dashboard ให้ตรงกับ Git repository นี้ ไม่มี `vercel.json` ที่ root และไม่มีการ deploy เว็บ Vanilla เดิม ถ้าเห็นข้อผิดพลาดหา Express entrypoint หรือ output `public` ให้ตรวจ Framework/Root Directory และ commit ที่ deployment ใช้อยู่

`npm run build` จาก repository root จะ build npm workspace `@iqi/frontend` และสร้าง `frontend/.next` เช่นกัน

## Server environment

คงค่าของ backend ไว้ใน Vercel project เดียว:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: Service Account JSON ทั้งไฟล์ โดยบัญชีต้องเข้าถึงทั้ง workbook ครุภัณฑ์และ workbook authentication
- `GOOGLE_SPREADSHEET_ID`, `AUTH_SPREADSHEET_ID`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_DOMAIN`
- `BOOTSTRAP_SUPER_ADMIN_EMAIL` ตามบัญชีหลักเดิม
- `APP_URL`: HTTPS origin ของ deployment จริงสำหรับ Google callback เช่น `https://your-project.vercel.app` โดยไม่มี path
- `FRONTEND_URL`: ไม่ต้องตั้งเมื่อ FE/BE อยู่ deployment เดียวกัน; ถ้าตั้งต้องเป็น origin ของหน้าเว็บจริง ห้ามใช้ localhost บน production
- `APP_SECRET`: secret เดิมอย่างน้อย 32 ตัวอักษร และ `APP_PASSWORD` ที่ backend configuration เดิมยังตรวจว่ามี (หน้าเว็บใช้ Google Login)
- ค่า `SHEET_*`, `IQI_DATE_*`, Drive OAuth/folder settings และ `ALLOWED_HOSTS` ที่ใช้อยู่

ใน Google Cloud OAuth client ลงทะเบียน Authorized redirect URI เป็น `${APP_URL}/api/auth/google/callback` ให้ตรงกันทุกตัวอักษร Preview deployment ที่ใช้ OAuth ต้องมี origin/redirect URI ของตัวเองที่ลงทะเบียนด้วย อย่าให้ callback ชี้คนละ deployment กับที่เริ่ม login

ใช้ [คู่มือ auth Sheets](auth-sheets.md), [Google OAuth](google-auth-phase-1.md) และ [บัญชีหลัก](single-super-admin.md) สำหรับ schema/สิทธิ์เดิม ไม่ต้องสร้าง Users/Admins/Sessions/AuditLogs ชุดใหม่เพราะเปลี่ยน frontend

ห้ามเติม `NEXT_PUBLIC_` ให้ credentials/tokens/secrets และห้ามใส่ `.env`, private workbook data หรือ credentials ใน `frontend/public/` ไฟล์เก่าอยู่ใน `legacy-frontend/` เพื่อเทียบ behavior และทดสอบเท่านั้น ไม่ใช่ runtime หรือ build input

## Local development

```sh
npm ci
cp .env.example .env               # เฉพาะครั้งแรก; เก็บค่าเดิมถ้ามีแล้ว
cp frontend/.env.example frontend/.env.local
npm run dev:api                    # Express :3000 อ่าน root .env
# อีก terminal
npm run dev                        # Next.js :3001
```

เปิด http://localhost:3001 ตั้ง root `.env` ให้ `APP_URL=http://localhost:3000` และ `FRONTEND_URL=http://localhost:3001` โดยลงทะเบียน callback `http://localhost:3000/api/auth/google/callback` ใน Google OAuth client Google จะส่ง callback เข้า Express :3000 แล้ว Express ส่งผู้ใช้กลับ Next.js :3001 ส่วน `frontend/.env.local` ใช้ `IQI_BACKEND_ORIGIN=http://localhost:3000` เพื่อ proxy API ไป Express ต้องรันทั้ง `dev:api` และ `dev`

ถ้าต้องการให้ Next.js รับ callback เองที่พอร์ต 3001 ก็ใช้ `APP_URL=http://localhost:3001` ได้ แต่ต้องลงทะเบียน redirect URI พอร์ต 3001 ใน Google OAuth client ด้วย ชื่อ host, port และ path ต้องตรงกันทั้งหมด เริ่ม login ใหม่หลังเปลี่ยน config

บน Vercel ค่านี้ถูกข้ามเพราะ Express ทำงานผ่าน Next API adapter ใน deployment เดียวกัน Next API body parsing ถูกปิดเพื่อให้ Express จัดการ JSON/binary uploads, cookie, CSRF และ authorization เหมือนเดิม Function duration 120 วินาที และ file tracing รวม backend/shared จาก repository root

`GOOGLE_SERVICE_ACCOUNT_FILE` และ `GOOGLE_DRIVE_OAUTH_FILE` ที่เป็น relative path จะอ้างจาก repository root เสมอ ทั้งเมื่อรัน Express และ Next.js; absolute path ใช้ตามเดิม บน Vercel ให้ใช้ JSON environment variables แทนไฟล์ credentials ในเครื่อง

## Verification

```sh
npm run check
npm run lint:web
npm run test:web
npm test
npm run build
npm run test:embedded-api
npm run test:proxy
```

Automated tests ใช้ fixtures ไม่อ่านหรือเขียน Google จริง Embedded API smoke test ตรวจ Google authorization redirect/state cookies, การปิด password login, anonymous session/logout, CSRF/Origin, frontend routes และ API authorization ส่วน proxy smoke test ใช้ SheetSessionService กับ in-memory auth storage เพื่อตรวจ sessions, STAFF permissions, Users, Audit, รายการของฉัน และยืม–คืน

หลัง deploy ต้องตรวจ Google OAuth callback และ Sheets/Drive กับบัญชีจริงอีกครั้ง การแก้ repo นี้ไม่ deploy, push หรือแก้ข้อมูล Google ให้เอง

## Existing backend limits

Sheet-backed sessions และ role/status checks ยังอยู่ใน Express ไม่ใช่ frontend; session หมดอายุตาม 30 นาทีเดิม Client ซ่อนเมนู/ปุ่มตาม permissions และล้าง query/draft เมื่อ logout หรือ API ตอบ 401

ข้อจำกัดเดิมของ backend ยังมีอยู่: hosted uploads จำกัด 4 MiB, local originals จำกัด 25 MiB และการเขียนฟอร์มยืม–คืนบน hosted mode ตอบ 503 เพราะ write lock รองรับ single server เท่านั้น การย้าย Next.js ไม่เปลี่ยนข้อจำกัดการเขียนข้อมูลนี้
