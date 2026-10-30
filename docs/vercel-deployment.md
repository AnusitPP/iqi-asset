# Deploy Next.js และ Express API บน Vercel project เดียว

Next.js อยู่ใน `frontend/` โดยมีโค้ดใน `frontend/src/` และ config เดียวที่ `frontend/vercel.json` ใช้ Express API ใน `backend/` ผ่าน Next API adapter โฟลเดอร์ `apps/web` และ Vanilla frontend เดิมถูกนำออกแล้ว

## Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Next.js |
| Build Command | `npm run build` (จาก `frontend/vercel.json`) |
| Install Command | `cd .. && npm ci` ติดตั้งจาก lockfile ที่ repository root |
| Output Directory | `.next` ภายใน `frontend/` |
| Include source files outside Root Directory | เปิด เพื่อรวม `backend/`, `api/`, `shared/` และ root lockfile |
| Node.js | 22.x หรือเวอร์ชันที่ตรงกับ `frontend/package.json` |

Root Directory เป็น Vercel project setting ต้องตั้งใน Dashboard; ไม่ได้เปลี่ยนจากการแก้ไฟล์ใน workspace นี้โดยอัตโนมัติ

จาก repository root คำสั่ง `npm run build` เรียก workspace `@iqi/frontend` และสร้าง `frontend/.next` หากเคยตั้ง Root Directory เป็นค่าว่าง, `apps/web` หรือ `backend` ให้เปลี่ยนเป็น `frontend` แล้ว deploy จาก commit ล่าสุด

## Server environment variables

คงค่าของ backend ไว้ใน project เดียวกัน:

- `APP_PASSWORD`, `APP_SECRET` (อย่างน้อย 32 ตัวอักษร)
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID`
- ชื่อแท็บและ Google Drive OAuth/folder settings ที่ใช้อยู่ ตาม root `.env.example`
- `ALLOWED_HOSTS` เมื่อใช้ custom hostname ที่ต้องเพิ่มจากค่าของ Vercel

ห้ามใช้ `NEXT_PUBLIC_` กับ credentials, tokens หรือ secrets และห้าม upload `.env`/`credentials` ไป public assets

`IQI_BACKEND_ORIGIN` ใช้เฉพาะ local development ที่รัน Express แยกพอร์ต บน Vercel ค่านี้ถูกข้าม เพราะ API อยู่ใน deployment เดียวกัน

## Routing และ build

- App Router ให้บริการ `/dashboard`, `/assets`, `/loans`, `/returns`, `/login`
- `frontend/src/pages/api/[[...path]].ts` ส่ง `/api/*` เข้า `api/index.js` และ Express เดิม ไม่มี business logic ซ้ำ
- ปิด Next API body parsing เพื่อให้ Express ตรวจ JSON และ binary uploads ตามเดิม
- Function duration 120 วินาที และ server tracing รวม backend/shared/dependencies จาก monorepo root
- Express standalone ให้บริการเฉพาะ API; ไม่เสิร์ฟหน้า HTML หรือ shared scripts ของเว็บเดิม

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

หลังตั้ง Project settings และ secrets ให้ redeploy แล้วตรวจ `/login`, `/dashboard` และ `/api/auth/session` ทดสอบ Google reads ด้วยสิทธิ์ที่เหมาะสม ส่วน live writes ควรใช้รายการทดสอบที่กำหนดไว้

Cookie, CSRF, Host/Origin, revision checks, local rate limits และ local write queues ยังคงเป็นของ backend เดิม ข้อจำกัด shared-state/Sheets atomicity และ platform upload limits ยังมีอยู่ Hosted upload จำกัด 4 MiB; local originals จำกัด 25 MiB

ฟอร์มยืม–คืนยังคงข้อจำกัดเดิม: hosted backend ตอบ 503 สำหรับการเขียน ต้องใช้ backend แบบ local/single server หากต้องใช้งานส่วนนี้

การแก้ workspace นี้ไม่ได้ deploy, commit, push หรือแก้ข้อมูล Google จริง

อ้างอิง: [Vercel monorepos](https://vercel.com/docs/monorepos), [build configuration](https://vercel.com/docs/builds/configure-a-build), [Next.js file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
