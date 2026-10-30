# IQI Asset — Next.js frontend

Frontend migration in the existing npm workspace. Express, Vercel API, Vanilla frontend, Google integration and production deployment remain unchanged. No deployment is performed.

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

Open http://localhost:3001. Set the server-only `IQI_BACKEND_ORIGIN` in `apps/web/.env.local` to the existing Express origin if its PORT differs. Do not put credentials or secrets in NEXT_PUBLIC variables. Restart Next after changing this setting. `next.config.ts` rewrites `/api/*` to Express; `src/proxy.ts` rejects foreign browser origins and translates a verified same-origin Origin to the configured backend origin. Cookies, CSRF, payloads and API paths are preserved. No API handlers, actions or duplicate backend services are introduced.

For a standalone local production preview, set the same backend origin **before build and start**, then run `npm run build:web` and `npm run start:web`. The existing `vercel.json` still deploys Vanilla; this task does not switch production.

## Vercel frontend build

Use `apps/web` as the frontend project's **Root Directory**. Its `vercel.json` selects Next.js and runs this workspace's `npm run build` (`next build --webpack`), producing `.next/` without running `backend/scripts/build-frontend.js` or building `frontend/dist/`.

In Vercel project settings:

- Framework Preset: **Next.js**.
- Root Directory: **apps/web** (relative to this Git repository).
- Build Command: use the checked-in configuration.
- Output Directory: leave the override disabled so Next.js uses its default.
- Enable **Include source files outside of the Root Directory in the Build Step**, because the application imports `shared/`.
- Set server-only `IQI_BACKEND_ORIGIN` to the separately hosted backend URL for Production/Preview as needed; do not use localhost or the frontend's own URL.

The repository-root `vercel.json` remains the existing backend/legacy deployment configuration. Keeping the Vercel Root Directory at the repository root will still select that configuration. This change does not update remote Vercel settings or deploy anything. Dependency installation can still include workspace/shared dependencies; only the frontend build target is restricted to `apps/web`.

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
```

The proxy acceptance test starts isolated real Express/Next processes with an in-memory fixture adapter and checks session, cookies, same-origin POST/PUT, revision payloads, rejected foreign Origin/CSRF, logout revocation, catalog data, loan/return submissions, duplicate request replay and page HTTP responses. It never loads `.env`, starts the normal backend, or calls Google APIs. Unit/component fixtures are restricted to tests. Application components use validated Express responses only.

`test:web` selects the Node executable used to start npm, avoiding an ancestor `node_modules/.bin/node` overriding the runtime on this machine.

## Acceptance still requiring live/manual checks

Live Sheets/Drive reads/writes, deployed secure-cookie behavior, physical mobile layouts, real HEIC conversion and browser image decoding/upload must be checked with configured services. Automated DOM tests do not replace visual browser QA. Upload progress counts completed files; the existing fetch transport exposes no byte progress. Clipboard copying retains the LAN HTTP selection fallback and shows a manual-copy message if both methods fail. Reload and workspace links warn for unsaved data; browser history navigation needs manual care. No claim of live Google API verification is made.

Loan/return writes retain the backend restriction: hosted Vercel writes return 503; the existing single-server/local backend is required. The frontend displays that server error. No production settings were changed.
