# Frontend migration report

> Historical migration record. Next.js now lives in frontend/ (src/, public/, next.config.ts and vercel.json). Express remains in backend/. Current instructions are in ../web.md and ../vercel-deployment.md; paths and counts below describe earlier migration stages.

## Delivered routes and features

`/` redirects to `/dashboard`; `/login` handles the existing password/session flow. Protected `/assets` provides debounced/IME search, pending-only empty queries, source groups, copy/inspection-age/identity metadata, revision-protected review selection, full-row read/edit with live dropdowns, Bangkok date shortcut, CRLF-preserving saves and unsaved-change confirmation, and review inspection with unchanged-date feedback. `/dashboard` provides existing progress/summary/comparison cards, filters, searchable table, revision-protected individual/bulk drafts (including hidden rows and retained failures), detail/team/notes editing, and Drive photo gallery/preview/upload with legacy deduplication, three-photo capacity, server upload limits, image resizing, HEIC passthrough, sequential revision chaining and partial failure feedback.

The current-source parity pass adds `/loans` and `/returns`, existing catalog selection, seven-day validation and idempotent requests, Dashboard team filtering/collapsible filters/skeleton, desktop sidebar/mobile Drawer, toasts, session-scoped UI persistence and task cancellation. No unsupported routes, fields or API endpoints were invented. Inspection remains a dialog within asset search, matching the original workflow.

## Architecture and contracts

- Providers: `AppProviders`, `AuthSessionProvider`, `UnsavedChangesProvider`; hook APIs `useAuthSession`, `useUnsavedChangesGuard`, `useHasUnsavedChanges`.
- Shared UI: `AuthenticatedWorkspace`, `ErrorAlert`, `LoadingIndicator`, `CopyableText`; feature-owned dialogs/forms in assets, inspections, dashboard and photos.
- `ApiClient` handles JSON/binary transport, abort signals, cookie credentials, CSRF, revision headers, non-JSON/corrupt payloads and HTTP errors with backend messages/status/Retry-After. Every JSON success is validated before components consume it.
- Zod response schemas: session, authentication, status/links, upload config, search records/groups, full row/dropdowns, review selection/inspection, dashboard records/summary/save, photo upload result.
- Zod form schemas: password, indexed full-row values, team/notes, review inspection. Types `SearchRecord`, `AssetRecord`, `DashboardRecord` are inferred; `ReviewTarget`, `StatusDraft` describe local workflow data. API input remains `unknown` until validated.
- TypeScript enables `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`; ESLint rejects explicit `any` and TS bypass comments. No unsafe double assertions or DOM rendering/state mutation is used. Native clipboard fallback and image canvas processing are isolated utilities.
- Next rewrites use server-only `IQI_BACKEND_ORIGIN`; the transport-only Proxy rejects foreign Origin before translating verified same-origin requests for the unchanged Express Origin check. Cookie/CSRF/auth authorization stays in Express. No API route handlers, server actions, duplicate services, Google client code or client credentials were added.

See [source/API inventory](migration-inventory.md) for endpoint and interaction mapping.

## Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck:web` | PASS |
| `npm run lint:web` | PASS, zero warnings |
| `npm run test:web` | PASS, 42 tests including current-source lending rules/forms, catalog keyboard selection, retry request IDs, duplicate submission lock, draft reset/persistence, team filtering, responsive menu behavior and task cancellation |
| `npm run build:web` | PASS, all routes and Proxy compiled |
| `npm test` | 173/175 pass. The same structure-import assertion fails in two runs because the existing `scripts/generate-token.cjs` imports missing `../src/config.js`. This task does not edit that script. HTTP tests require localhost permission in this sandbox. |
| `npm run test:proxy --workspace @iqi/web` | PASS, real unchanged Express + Next with isolated fixture adapter; session, cookie login, authenticated GET, revision PUT, rejected foreign Origin and CSRF, logout/revocation, loan catalog, real fixture-backed loan/return writes and loan idempotency, page HTTP responses |
| `git diff --check` | PASS |
| Protected directories and `vercel.json` | No diff |
| Pre-existing locked dependency versions | Unchanged |
| Migrated application source scan | No `any`, TS bypass comments, unsafe double assertions, `innerHTML`, or `querySelector` |

Tests use fixtures only in isolated test code. The normal app always requests Express. The proxy acceptance test uses a separate Next build directory and stops only its owned test processes, preserving an existing dev server.

## Unverified and limitations

No live Google Sheets/Drive reads or writes were exercised. Real HEIC/JPEG browser decoding, photo conversion/storage, mobile visual fidelity, deployed secure-cookie behavior and end-to-end user acceptance require configured services and browser testing. No browser automation tool was available; component tests and HTTP checks do not establish visual parity. Upload progress represents completed files, not byte progress. Unsaved-change warnings cover reload, workspace links, dialog closure and logout; browser history navigation is not intercepted.

The existing locked backend dependency `body-parser` 2.3.0 was reported by npm audit as high severity. It was not upgraded because this migration preserves existing backend dependency versions. Newly introduced tooling was updated to avoid the advisories found in older Vitest versions.

## Run

Use Node 22.12+:

```sh
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev       # Existing Express; separate terminal
npm run dev:web   # http://localhost:3001
```

Set `IQI_BACKEND_ORIGIN` to the actual Express origin when its port differs. For local production preview, set it before both build and start. Existing Vercel production settings remain untouched. No deploy, commit or push was performed.

## Files created or updated

Work is concentrated in `apps/web`. Root updates cover workspace scripts/dependencies and the lockfile, README, generated-file ignores and ESLint generated-directory ignores. Existing `frontend/`, `backend/`, `api/`, `shared/`, `credentials/`, `test/` and `vercel.json` remain unchanged. Next dev generated the advisory `AGENTS.md`; no additional agents were used.

Application files (relative to `apps/web`):

- `.env.example`
- `AGENTS.md`
- `README.md`
- `docs/migration-inventory.md`
- `eslint.config.mjs`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `public/assets/fonts/latin.woff2`
- `public/assets/fonts/thai.woff2`
- `scripts/run-tests.mjs`
- `scripts/verify-proxy.mjs`
- `src/app/(protected)/assets/page.tsx`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/(protected)/layout.tsx`
- `src/app/dashboard.css`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/legacy.css`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/components/layout/workspace.tsx`
- `src/components/ui/feedback.tsx`
- `src/features/assets/assets-page.tsx`
- `src/features/assets/record-dialog.tsx`
- `src/features/auth/auth-provider.tsx`
- `src/features/auth/login-page.tsx`
- `src/features/dashboard/dashboard-details.tsx`
- `src/features/dashboard/dashboard-page.tsx`
- `src/features/dashboard/save-drafts.ts`
- `src/features/inspections/inspection-dialog.tsx`
- `src/features/photos/photo-editor.tsx`
- `src/features/photos/photo-utils.ts`
- `src/hooks/use-unsaved.tsx`
- `src/lib/api-client.ts`
- `src/lib/clipboard.ts`
- `src/lib/display.ts`
- `src/providers/app-providers.tsx`
- `src/proxy.ts`
- `src/types/contracts.ts`
- `tests/contracts.test.ts`
- `tests/interactions.test.tsx`
- `tests/setup.ts`
- `tsconfig.json`
- `vitest.config.ts`


## Current-source parity verification

The current backend rejects loan/return writes when hosted (503). This restriction is preserved; local/single-server fixture writes passed through real Next-to-Express requests. No live Google calls were made. Protected source directories were hashed before and after the work and remain unchanged during this pass. `shared/` modules are reused without edits.

New implementation files include `types/lending.ts`, `types/shared-modules.d.ts`, `services/catalog.service.ts`, `services/loans.service.ts`, `services/returns.service.ts`, `features/lending/*`, `features/loans/loans-page.tsx`, `features/returns/returns-page.tsx`, protected loans/returns routes, `hooks/use-workspace-state.ts`, `hooks/use-session-task-guard.ts`, `providers/toast-provider.tsx`, `components/ui/dashboard-skeleton.tsx`, and lending/workspace tests. Existing source/features/providers/styles and the proxy acceptance fixture were updated accordingly.


## Combined Vercel deployment update

The Next app now exposes `src/pages/api/[[...path]].ts`, a thin re-export of the original Express Vercel entrypoint, with body parsing disabled and `maxDuration: 120`. It does not duplicate business logic. The project can deploy FE and BE together with Root Directory `apps/web`, Next.js preset, and external-root source inclusion enabled. `outputFileTracingRoot` and backend/shared includes keep server runtime dependencies in the function bundle. On Vercel, the external backend rewrite and Origin translation are disabled. Existing backend/Google environment variables stay on the same project. The old root-level Vercel config is only used when the project root is left at the repository root.

Express static paths were changed from directory `new URL` expressions to equivalent `dirname`/`resolve` expressions for Webpack compatibility. API routes, authentication, Google integrations, and lending restrictions were not changed. Local tests passed for the embedded Express adapter (session/login/logout, cookie, JSON parsing, CSRF/Origin, upload limits and protected API). No live Google writes or cloud deployment were performed. See README for current settings rather than historical separate-project instructions above.
