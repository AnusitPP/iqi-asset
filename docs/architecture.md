# โครงสร้างโปรเจกต์

Frontend เดียวของระบบอยู่ที่ `frontend/` ใช้ Next.js App Router และ strict TypeScript โฟลเดอร์ frontend เดิมถูกนำออกแล้ว Express ให้บริการเฉพาะ API และยังใช้ Google Sheets/Drive integration เดิม

## จุดเริ่มต้น

- `frontend/src/app/`: layout และ routes `/login`, `/dashboard`, `/assets`, `/loans`, `/returns`
- `frontend/src/pages/api/[[...path]].ts`: ตัวเชื่อม Node HTTP request เข้า Express เดิม ปิด body parser ของ Next เพื่อคง JSON/binary upload behavior
- `api/index.js`: Express entrypoint ที่โหลด runtime แบบ lazy และตอบ error อย่างปลอดภัย
- `backend/src/runtime.js`: ประกอบ Google adapter, services และ Express app
- `backend/src/http/app.js`: ติดตั้ง security, auth, readiness และ feature API routes ไม่มี static frontend routes
- `backend/server.js`: เปิด Express API บน localhost ตาม `.env`

## Frontend

```text
frontend/src/
  app/                  App Router pages/layouts
  pages/api/            ตัวเชื่อม Express
  features/
    auth/               session และ login
    assets/             ค้นหา/แก้ไขครุภัณฑ์
    dashboard/          summary, filters, status drafts, details
    inspections/        ผลตรวจรายการรอตรวจสอบ
    photos/             preview, resize และ upload
    lending/            ฟอร์มร่วมและ catalog picker
    loans/              หน้ายืม
    returns/            หน้าคืน
  services/             API แยกตามหมวด
  components/           layout และ reusable UI
  hooks/                session-scoped state, unsaved/task guards
  providers/            Mantine, Query, session และ toast
  lib/                  API transport, display และ clipboard helpers
  types/                Zod contracts และ TypeScript declarations
```

## Backend และ shared

- `backend/src/features/`: records, dashboard, review, photos, loans, returns, catalog และ auth
- `backend/src/core/`: config, HTTP security, validation, signed tokens, state, lending ledger และ locks
- `backend/src/integrations/google/`: Google Sheets, Drive authentication/storage
- `shared/core/`: วันเวลา, formatters และข้อความร่วม
- `shared/features/`: catalog, lending constants/status, photo slots และ search status

Frontend เรียก API ผ่าน `services/` แล้วตรวจ response ด้วย Zod; cookie, CSRF, revision และ authorization ยังตรวจใน Express เก็บ secrets ไว้ใน `.env` หรือ server environment เท่านั้น

## Commands จาก root

- `npm run dev:api`: Express API ที่พอร์ต 3000
- `npm run dev`: Next.js ที่พอร์ต 3001 โดย proxy ไป Express ตาม `IQI_BACKEND_ORIGIN`
- `npm run build`: build Next.js และ API adapter ไปที่ `frontend/.next`
- `npm start`: เปิด Next production server หลัง build
- `npm run check`, `npm run lint:web`, `npm run test:web`: ตรวจ frontend และ entrypoints
- `npm test`: ตรวจ backend/shared และ integration tests

`frontend/vercel.json` เป็น deployment config เดียว ตั้ง Root Directory บน Vercel เป็น `frontend` และ Framework เป็น Next.js พร้อมเปิด include source outside root เพื่อ bundle `api`, `backend` และ `shared` เข้าด้วยกัน

สคริปต์ส่วนตัวใน root `scripts/` ถูก ignore และไม่ใช่ application runtime หรือ build input; maintenance scripts ที่ดูแลในโปรเจกต์อยู่ที่ `backend/scripts/`
