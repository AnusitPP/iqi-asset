# IQI Asset — Next.js frontend

The only frontend is the Next.js application in this npm workspace. The original Express API is reused through a thin Next.js adapter for a combined frontend/backend Vercel deployment. Google integrations and business rules remain in `backend/`. The Vanilla frontend, its build script and the root Vercel config have been removed. No deployment is performed automatically.

## Run locally

Use Node **22.12+** (including frontend tooling).

```sh
# Repository root
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev          # Existing Express, default port 3000
# In another terminal
npm run dev:web      # Next.js, port 3001
```

Open http://localhost:3001. Set the server-only `IQI_BACKEND_ORIGIN` in `apps/web/.env.local` to the existing Express origin if its PORT differs. Do not put credentials or secrets in NEXT_PUBLIC variables. Restart Next after changing this setting. `next.config.ts` rewrites `/api/*` to Express; `src/proxy.ts` rejects foreign browser origins and translates a verified same-origin Origin to the configured backend origin. Cookies, CSRF, payloads and API paths are preserved. On Vercel, `src/pages/api/[[...path]].ts` forwards requests to the existing `api/index.js` Express entrypoint. It contains no duplicated API/business logic, and disables Next body parsing so Express still handles JSON and binary bodies.

For a standalone local production preview, set the same backend origin **before build and start**, then run `npm run build:web` and `npm run start:web`. When running locally, `IQI_BACKEND_ORIGIN` continues to select the separate Express server. On Vercel (`VERCEL=1`), that external rewrite and Origin translation are disabled; same-origin API requests are handled by the embedded Express adapter.

## Vercel: deploy frontend and backend together

Use the **same Vercel project**, with **Root Directory = apps/web**. `apps/web/vercel.json` selects Next.js and runs `npm run build`. Next builds the web pages and the catch-all API adapter together. `frontend/dist/` is not built or served by this deployment.

Project settings:

- Root Directory: `apps/web` (relative to the Git repository).
- Framework Preset: `Next.js`.
- Build Command: `npm run build`, as declared in this app's `vercel.json`.
- Output Directory: disable any previous `frontend/dist` override; use Next.js default.
- Enable **Include source files outside of the Root Directory in the Build Step**. The adapter imports the original `api/index.js`, `backend/` and `shared/`.
- Retain the existing backend environment variables in this project, including `APP_PASSWORD`, `APP_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SPREADSHEET_ID`, and existing Drive settings where used. Never add a `NEXT_PUBLIC_` prefix to secrets.
- `IQI_BACKEND_ORIGIN` is for separate-server local development; it is ignored on Vercel to prevent calls to localhost or rewrite loops.

`next.config.ts` traces server dependencies from the repository root and includes backend/shared runtime files. Native/backend packages stay external. The API adapter retains the 120-second function setting. Express serves API requests only; its legacy static-file middleware has been removed. Authentication, CSRF and backend business rules remain intact.

`apps/web/vercel.json` is the single deployment config. Set Vercel Root Directory to `apps/web` and clear old output/build overrides before redeploying. From the repository root, `npm run build` also targets this workspace. This workspace change does not update remote Vercel settings or deploy anything.

## Routes and architecture

- `/` redirects to `/dashboard`.
- `/login`: password validation and existing session API.
- `/assets`: debounced/IME-aware search, pending filter, grouped results, review selection, record details/editing, review inspection dialog.
- `/dashboard`: progress chart, collapsible summary/comparison filters, exact team filtering, searchable table, individual/bulk status saves, team/notes, Drive photo gallery/upload.
- `/loans`: catalog selection, borrower/team/purpose, ISO loan dates with the existing seven-day rule, notes, duplicate-safe submission.
- `/returns`: catalog selection, borrower/team/return date, notes, duplicate-safe submission.

`features/auth`, `assets`, `dashboard`, `inspections`, `photos`, `lending`, `loans` and `returns` own behavior. Categorized `services/` owns every API call. `components/layout` owns the protected workspace; `components/ui` owns shared feedback/copy. `providers` installs Mantine, Query, auth, unsaved state and transient toast feedback. Search filters, dashboard filters and loan/return drafts survive route changes within a session and are cleared by auth cleanup. Desktop navigation uses a sidebar; mobile navigation uses an accessible Mantine Drawer. `lib/api-client.ts` is the only JSON/binary request boundary; `types/contracts.ts` validates responses and form data with Zod and infers strict types. `hooks/use-unsaved.tsx` guards reload and workspace navigation. `lib/display.ts` preserves Bangkok/Buddhist dates, note replacement and untouched CRLF values. The copied legacy styles/fonts are adapted only inside this app.

See [verification and file report](docs/migration-report.md) and [migration inventory](docs/migration-inventory.md) for source-to-route/API mapping. The loan and return forms use the current existing `/api/loan-catalog`, `POST /api/loans` and `POST /api/returns` endpoints. Shared teams, terms, category mapping, catalog matching and calendar-date rules are imported from `shared/` with frontend TypeScript declarations. Review inspection stays in the existing search workflow.

## Checks

```sh
npm run typecheck:web
npm run lint:web
npm run test:web
npm run build:web
npm test
npm run test:proxy --workspace @iqi/web
npm run test:embedded-api --workspace @iqi/web
```

The proxy acceptance test starts isolated real Express/Next processes with an in-memory fixture adapter and checks session, cookies, same-origin POST/PUT, revision payloads, rejected foreign Origin/CSRF, logout revocation, catalog data, loan/return submissions, duplicate request replay and page HTTP responses. It never loads `.env`, starts the normal backend, or calls Google APIs. Unit/component fixtures are restricted to tests. Application components use validated Express responses only.

`test:web` selects the Node executable used to start npm, avoiding an ancestor `node_modules/.bin/node` overriding the runtime on this machine.

## Acceptance still requiring live/manual checks

Live Sheets/Drive reads/writes, deployed secure-cookie behavior, physical mobile layouts, real HEIC conversion and browser image decoding/upload must be checked with configured services. Automated DOM tests do not replace visual browser QA. Upload progress counts completed files; the existing fetch transport exposes no byte progress. Clipboard copying retains the LAN HTTP selection fallback and shows a manual-copy message if both methods fail. Reload and workspace links warn for unsaved data; browser history navigation needs manual care. No claim of live Google API verification is made.

Loan/return writes retain the backend restriction: hosted Vercel writes return 503; the existing single-server/local backend is required. The frontend displays that server error. No remote Vercel project settings were changed.

The embedded-API smoke test starts a temporary Next dev server in hosted mode with synthetic auth configuration. It checks frontend HTML, original Express session/cookie login/logout, unconsumed JSON streams, CSRF/Origin rejection, upload limits and API authorization. It makes no Google API calls. The separate-proxy fixture test remains available for local development.
