# IT Service Portal redesign

Implemented on `feature/fe-new-structure` in the existing Next.js frontend. No new project, UI framework, dependencies, backend endpoints, Google contracts, authentication behavior, environment variable names or Vercel configuration were introduced or changed.

## Interface

- `/` is now a protected Home Page: หน้าหลักระบบงานไอที, four service category cards, operational summaries, actual recent navigation and API-backed activity.
- The shared workspace uses a 254px desktop sidebar, a 72px icon-only mode with tooltips, collapsible navigation groups, active route highlighting, breadcrumbs, profile/role and logout.
- Mobile/tablet use the existing Mantine Drawer. Navigation closes it after following a link. Collapsed/group states and recent visits persist within the authenticated QueryClient session and clear with existing logout cleanup.
- Added green design tokens matching the brief, responsive grids, accessible focus styles, skip-to-content navigation and reduced-motion support. Reused Mantine, Lucide, Noto Sans Thai, existing avatar and feedback components.
- Existing unsaved-change confirmations apply to sidebar, breadcrumbs and Home service links. Existing authentication redirects/session services were retained.

## Data and permissions

| Home area                                                                                                                                                                                                                                                                                                    | Existing source                                            | Behavior                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| รายการครุภัณฑ์ / ตรวจเช็คแล้ว / รอการตรวจเช็ค                                                                                                                                                                                                                                                                | `dashboardService.fetchDashboardData()` → `/api/dashboard` | Uses total, completed and total minus completed; labels refer to Dashboard records, not deduplicated inventory. Only requests data with ADMIN_DASHBOARD_VIEW. |
| คำร้องของฉัน                                                                                                                                                                                                                                                                                                 | `myRequestsService.list()` → `/api/my-requests`            | Counts returned own requests; only requests with LOAN_VIEW_OWN.                                                                                               |
| Unavailable/forbidden summary values show an explicit unavailable state rather than zero. Loading, empty, error and retry states are retained. No purchase/printer counters or notification badge were invented. Navigation filters existing permission grants; backend authorization remains authoritative. |

## Routes

| Route                 | Function                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | New protected portal Home                                                                                                    |
| `/dashboard`          | Existing inspection progress, search, filters, asset table, individual/bulk updates and refresh                              |
| `/assets`             | Existing asset search, pending/review selection, inspection and record details/editing; navigation label is ตรวจเช็คครุภัณฑ์ |
| `/loans`, `/returns`  | Existing loan and return forms, catalog selection and API integrations                                                       |
| `/my-requests`        | Existing personal requests                                                                                                   |
| `/users`              | Existing user administration                                                                                                 |
| `/audit`              | Existing Audit Log and details                                                                                               |
| `/login`, `/api/*`    | Existing login/logout/session and Express adapter                                                                            |
| `/services/[service]` | Configured, statically generated planned-service pages. Unknown slugs return 404.                                            |

Planned-service destinations clearly show **อยู่ระหว่างพัฒนา**, provide a Home link and have no forms, API calls or invented business workflow:

| Service                   | Route                             |
| ------------------------- | --------------------------------- |
| ถือครองครุภัณฑ์           | `/services/asset-holdings`        |
| เบิกวัสดุ                 | `/services/material-requisition`  |
| ขอซื้อซอฟต์แวร์ ฮาร์ดแวร์ | `/services/purchase-request`      |
| ยืมใช้ซอฟต์แวร์           | `/services/software-loan`         |
| สร้าง Teams               | `/services/teams`                 |
| ลงทะเบียน Printer         | `/services/printer`               |
| JumboGuest                | `/services/jumbo-guest`           |
| เว็บไซต์                  | `/services/websites`              |
| ชดเชยคอม2                 | `/services/computer-compensation` |
| อื่น ๆ                    | `/services/other`                 |

No existing external service URLs for these planned modules were found, so none were fabricated. Existing runtime sheet links remain available under ลิงก์ชีตที่เกี่ยวข้อง.

## Created files

- `frontend/src/config/navigation.ts`: central route, service, module, icon and permission definitions.
- `frontend/src/components/portal/app-sidebar.tsx`: desktop/mobile sidebar and accessible navigation groups/items.
- `frontend/src/components/portal/topbar.tsx`: mobile toggle, breadcrumbs, connection state and current user.
- `frontend/src/components/portal/navigation-context.tsx`: shared unsaved-navigation checks and mobile close action.
- `frontend/src/components/portal/page-header.tsx`: shared page heading.
- `frontend/src/components/portal/module-card.tsx`: permission-aware category cards.
- `frontend/src/components/portal/service-link.tsx`: internal/external service link presentation.
- `frontend/src/components/portal/stat-card.tsx`: loading/ready/restricted/error summary card.
- `frontend/src/features/home/home-page.tsx`: Home composition.
- `frontend/src/features/home/home-statistics.tsx`: existing API queries and derived summaries.
- `frontend/src/features/home/recent-activity.tsx`: authorized audit activity.
- `frontend/src/features/home/recently-used.tsx`: actual session route history.
- `frontend/src/app/(protected)/services/[service]/page.tsx`: planned-service pages and metadata.
- `frontend/src/app/portal.css`: isolated portal layout and design tokens.
- `frontend/tests/portal.test.tsx`: portal interaction/data/permission regression tests.
- `docs/it-service-portal-redesign.md`: implementation report.

## Modified files

- `frontend/src/components/layout/workspace.tsx`: reusable shell integration, retained auth guards/logout/status/sheet links.
- `frontend/src/app/page.tsx`: Home replaces the previous redirect; existing service routes remain intact.
- `frontend/src/app/layout.tsx`: imports portal styles and updates portal metadata.
- `frontend/src/providers/app-providers.tsx`: existing Mantine theme receives the supplied green palette.
- `frontend/tests/workspace.test.tsx`: mobile navigation expectation uses the new inspection label.
- `docs/architecture.md`: links this report.

Next.js may regenerate `frontend/next-env.d.ts` during checks. Shared component styles are maintained in `frontend/src/app/components.css`.

## Adding a module

Add a service/category entry in `src/config/navigation.ts`; the sidebar, breadcrumbs, Home module cards, permission filtering and recent-history labels use the same configuration. For a planned internal service use `planned: true` and a `/services/<single-slug>` href. The dynamic page generates its destination from that href. Implemented modules should retain their actual route and existing API/service code. External services can use an actual URL with `external: true` when one exists.

## Verification

- `npm run check`: passed.
- `npm run lint:web`: passed with zero warnings.
- `npm run test:web`: 64 tests passed, including the existing dashboard, forms, photos, auth, users and audit tests plus portal tests.
- `VERCEL=1 npm run build`: passed, including the Home, all existing pages and ten generated planned-service pages.
- Chrome headless with fixture API interception: checked 320, 390, 768, 1024 and 1440px widths; no horizontal overflow. Verified sidebar collapse persistence, mobile drawer navigation, actual recent visits, dismiss/accept unsaved-form navigation, all planned destinations and unknown-slug 404. No browser page errors.
- No backend/shared/auth/environment/deployment files were changed for this redesign. No live Google requests, writes, deployment, commit or push were performed.

Local QA previews are temporary artifacts under `/tmp/iqi-portal-desktop-final.png`, `/tmp/iqi-portal-collapsed.png`, `/tmp/iqi-portal-mobile.png` and `/tmp/iqi-portal-mobile-menu.png`. Their values/user names are test fixtures only, never production defaults.

## Remaining scope

The referenced image was not attached to the supplied task, so the visual implementation follows its written layout, colors and navigation requirements; no pixel-level comparison to that image was possible. Planned modules need real product requirements/integrations before becoming operational. No new environment or Vercel settings are required. Existing backend limits, including hosted lending write restrictions, are unchanged.
