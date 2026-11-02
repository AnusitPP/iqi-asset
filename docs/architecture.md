# โครงสร้างโปรเจกต์

Frontend เป็น Next.js App Router + strict TypeScript ใน npm workspace `frontend/` และเรียก Express API เดิมใน `backend/` ผ่าน services แยกหมวด โค้ด Vanilla เดิมเก็บใน `legacy-frontend/` สำหรับเทียบ behavior และ regression tests

## Frontend

```text
frontend/
  src/
    app/                    routes/layouts และ protected workspace
    pages/api/              Express adapter; ปิด Next body parser
    features/
      auth/                 Google Login, session profile, logout
      assets/               ค้นหา/แก้ไขครุภัณฑ์
      dashboard/            สถิติ, filters, bulk status, รายละเอียด
      inspections/          บันทึกผลตรวจ
      photos/               gallery, preview, resize และ upload
      lending/              catalog, form shell และ draft/submit hook
      loans/                ฟอร์มยืม
      returns/              ฟอร์มคืน
      my-requests/          รายการยืม–คืนของผู้ใช้
      users/                ผู้ใช้งาน, filters, pagination, role/status
      audit/                Audit Log, filters, before/after details
    services/               API calls แยกหมวด
    components/             workspace, avatar และ UI ที่ใช้ร่วมกัน
    providers/              Mantine, Query, auth, unsaved และ toast
    types/                  Zod response contracts และ TS declarations
  tests/                    unit/component regression tests
  scripts/                  test runner และ HTTP acceptance checks
  vercel.json               config deploy เดียว
```

Routes: `/login`, `/assets`, `/dashboard`, `/loans`, `/returns`, `/my-requests`, `/users`, `/audit` หลัง Google callback staff ไปหน้าค้นหา ส่วนผู้มีสิทธิ์ Dashboard ไป Dashboard เมนูและปุ่มแก้ไขตรวจจาก permissions ของ `/api/auth/me` แต่ backend ยังเป็นผู้ตรวจ authorization ทุก request

`frontend/src/pages/api/[[...path]].ts` ส่ง Node HTTP request เข้า `api/index.js` ซึ่งโหลด `backend/src/runtime.js` ตามเดิม ไม่มี business logic ซ้ำ Local development ใช้ Next proxy ไป Express :3000 โดยปฏิเสธ browser Origin ต่างเว็บ ส่วน Vercel ใช้ Express ใน Next API function เดียวกัน

## Backend และ shared

- `backend/src/features/`: records, dashboard, review, photos, loans, returns, catalog, Google auth, users และ audit
- `backend/src/core/`: config, security/CSRF, signed revisions, state และ lending ledger
- `backend/src/integrations/google/`: Google Sheets/Drive/OAuth และ auth storage
- `shared/`: dates, labels, catalog, lending constants, permissions และ profile URL validation
- `test/`: backend/shared/legacy-model regression tests และ integration tests

Express standalone ให้บริการเฉพาะ API ไม่เสิร์ฟเว็บ Vanilla เดิม `legacy-frontend/` ไม่มี route ที่เข้าถึงจาก production frontend ดู feature parity และข้อจำกัดใน [migration report](frontend-migration.md)

## Commands จาก root

- `npm run dev:api`: Express API :3000
- `npm run dev`: Next.js :3001
- `npm run build`: build workspace ไป `frontend/.next`
- `npm start`: Next production server หลัง build
- `npm run check`, `npm run lint:web`, `npm run test:web`: ตรวจ frontend
- `npm test`: backend/shared/legacy-model tests
- `npm run test:embedded-api`, `npm run test:proxy`: isolated HTTP acceptance tests

ดู [deployment settings](vercel-deployment.md) ก่อน deploy จาก Git; Root Directory ต้องเป็น `frontend` และเปิด source files outside root

## IT Service Portal

หน้า `/` เป็น Home ของบริการไอที และใช้ navigation กลางที่ `frontend/src/config/navigation.ts` ร่วมกับ sidebar, breadcrumbs และ module cards หน้าทำงานเดิมยังใช้ routes เดิม ส่วน `/services/[service]` ใช้เฉพาะบริการที่ระบุว่าอยู่ระหว่างพัฒนา ดู [รายงาน redesign และรายการไฟล์/route](it-service-portal-redesign.md)
