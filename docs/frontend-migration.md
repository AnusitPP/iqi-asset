# Next.js migration and feature parity

The current Vanilla implementation was retained in `legacy-frontend/` for comparison and existing model regression tests. The earlier Next.js implementation from repository history supplied the existing assets/dashboard/photos/lending components. It was updated for the current Google identity, Sheet-backed sessions and role model rather than bringing back the old password login.

| Existing behavior                                                           | Next.js implementation                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Google Login, profile/avatar, logout                                        | `features/auth`, `components/ui/user-avatar.tsx`, `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`         |
| Role-based menu and edit controls                                           | `components/layout/workspace.tsx`, server-issued permissions; Express authorization unchanged                    |
| Asset search, pending filter, grouped results, details/editing              | `features/assets`; shared labels/dates/revisions retained                                                        |
| Review selection and inspection                                             | `features/assets`, `features/inspections`; writes hidden for users without ASSET_EDIT                            |
| Dashboard statistics/comparison/team/search filters                         | `features/dashboard`; collapse controls and progress retained                                                    |
| Individual/bulk saves and team/notes editing                                | `features/dashboard`; sequential revisions, stale drafts and cancellation retained                               |
| Drive gallery, image preparation, upload limits/progress                    | `features/photos`; original backend transport retained                                                           |
| Loan and return forms, catalog selection, seven calendar days               | `features/loans`, `features/returns`, `features/lending`; borrower is populated/read-only from signed-in profile |
| My requests                                                                 | `features/my-requests`, existing `/api/my-requests`                                                              |
| User filtering, latest-login sort, pagination, detail and role/status edits | `features/users`, existing GET/PATCH `/api/admin/users` endpoints; sole SUPER_ADMIN read-only                    |
| Audit search/action/type filters and before/after detail                    | `features/audit`, existing `/api/audit`; text rendered through React                                             |
| Desktop sidebar/mobile navigation, unsaved state, retry/feedback            | shared workspace, Mantine Drawer, unsaved/task guards and toast                                                  |
| Same-project Vercel API                                                     | `src/pages/api/[[...path]].ts`, original `api/index.js`, monorepo file tracing                                   |

All JSON/binary calls go through categorized `services/` and the typed `ApiClient`; Zod validates responses. Existing Google Sheets schemas, roles, service-account credentials, identity/session behavior and API business logic are retained. New UI data is not stored in browser localStorage; session query caches/drafts clear on logout or unauthorized responses.

The loan form loads `/api/loan-catalog` from the พร้อมยืม sheet. The return form loads `/api/return-catalog` from the รายการยืมครุภัณฑ์ sheet, using separate query caches. Return catalog records contain only row, asset, serial and name; submission validation remains in the existing lending services.

Automated verification covers frontend interaction/contracts, Google-session redirects/logout, permissions, user filtering/editing, audit detail/filtering, own requests, form dates/idempotency/draft isolation, backend/auth regression suites, production build and two isolated HTTP smoke scripts. Tests do not perform real Google OAuth token exchange, Sheets writes, Drive uploads, mobile visual QA or a live Vercel deployment. Real account/service checks remain necessary after configuring OAuth and deployment environment.

Hosted lending writes retain the existing 503 single-server restriction; frontend migration does not implement distributed Sheets transactions. Browser history navigation should still be checked manually for unsaved drafts. See [deployment guide](vercel-deployment.md) for commands and OAuth callback origins.
