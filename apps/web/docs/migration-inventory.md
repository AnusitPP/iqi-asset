# Migration inventory

Source inspected: `frontend/public/index.html`, both CSS files, `js/app.js`, all dashboard/photo modules, all utils, icons, both shared utilities, Express route/auth contracts and record/dashboard/review/photo services.

| Existing UI / behavior                                                                                                     | React destination                                  | API / contract                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Password modal, initialize session, logout                                                                                 | `/login`, AuthProvider, protected layout           | GET auth/session; POST auth/login and auth/logout; X-IQI-Request from session                           |
| Connection badge and sheet links                                                                                           | Workspace layout                                   | GET status: connected, csrf, reviewUrl, iqiItUrl                                                        |
| Search tab, 300ms debounce, IME, pending filter, group counts, fallback explanation                                        | `/assets`, AssetsPage                              | GET search?q=&pendingOnly=0/1; groups and sourceSheet                                                   |
| Copy code, identity, inspection age, review destination                                                                    | Asset result cards                                 | Search record metadata; Bangkok Buddhist dates                                                          |
| Heart / remove review selection                                                                                            | Asset cards                                        | PUT review-selection: sheet,row,revision,pending                                                        |
| Full row details, editable IQI only, live dropdowns, all columns, CRLF preservation, date shortcut, unsaved confirmation   | RecordDialog                                       | GET record?sheet=&row=; PUT iqi/:row: sheet,revision,values                                             |
| Review inspection modal, current date/status, unchanged date feedback                                                      | InspectionDialog inside `/assets`                  | GET/PUT review-inspection: sheet,row,revision,status                                                    |
| Dashboard tab, reload, progress chart, summary filters, comparison cards, text filter, table                               | `/dashboard`, DashboardPage                        | GET dashboard; authoritative summaries                                                                  |
| Per-row status drafts, bulk sequential saves, failures retain drafts including filtered rows                               | DashboardPage                                      | PUT dashboard/:row/status: status,revision                                                              |
| Team and notes edit, all non-photo fields                                                                                  | DashboardDetails                                   | PUT dashboard/:row/details: revision,team?,notes?                                                       |
| Drive gallery, legacy photo dedupe, max 3, previews, sequential upload, resize, HEIC, server upload limit, partial failure | PhotoEditor                                        | GET upload-config; POST dashboard/:row/photos binary + X-Record-Revision; GET dashboard/:row/photos/:id |
| Toast, alerts, loading/retry, responsive tabs/header/footer                                                                | Mantine UI, feedback, copied/adapted legacy styles | Errors retain server message + HTTP status                                                              |

The current source has Dashboard, search, loans and returns navigation with desktop sidebar/mobile menu. Next.js now provides `/loans` and `/returns`, using the existing catalog and form submission APIs. Inspection remains the review-card dialog; no redundant inspection route. Root redirects to dashboard. The original frontend is retained and backend business logic remains in place. A thin Next Pages API adapter now reuses the existing Express entrypoint for same-project deployment; no backend logic, Server Actions, or Google API code was duplicated. Express static path construction was adjusted for Webpack compatibility.

## Verification limits

See final task report for executed checks. Live Google Sheets/Drive writes require a configured backend and deliberate manual acceptance. Isolated tests use fixtures only; application code always calls Express. UI protection is a session gate; Express remains authoritative for authorization.


## Current-source parity additions

| Existing source | Next.js equivalent | API / behavior |
| --- | --- | --- |
| `core/forms/lendingForm.js`, `features/loans/loans.js` | `/loans`, `LendingRequestForm` | POST `/api/loans`; borrower, team, category, selectedAsset, identifier, notes, purpose, start, due, requestId; same requestId on unedited retries |
| `features/returns/returns.js` and shared lending form | `/returns`, same form in return mode | POST `/api/returns`; common fields + date; no invented return status or loan-id fields |
| `core/components/catalog/search.js` | `LendingCatalogPicker` | GET `/api/loan-catalog`; multiword asset/SN/name matching, keyboard arrows/Enter/Escape, required selection and readonly identifier |
| `shared/features/lending`, catalog search, date extensions | Imported shared modules + local `.d.ts` declarations | Original teams, category mapping, terms, seven-calendar-day rule and ISO date semantics |
| Dashboard team dropdown | Header team selector | Exact trimmed team match, combines with text/status/comparison, clear all |
| Dashboard `<details>` filters and skeleton | `<details>` + Mantine skeleton | Collapsible filters retain state across navigation |
| Workspace menu | Desktop sidebar + Mantine Drawer | Four Next Links, Escape/outside close, focus return, media-query close |
| Existing tab state retention | Session-scoped Query cache | Search/filter states and lending drafts retained across route changes; cleared at logout |
| Toast feedback | `ToastProvider` | 4.5-second dismissible notifications, including modal workflows |
| Generation guards around batch writes | `useSessionTaskGuard` | Stops subsequent bulk writes/uploads after route unmount or session reset; bulk also stops on 401 |

Only form submission and catalog flows existing in the current Vanilla UI were migrated. No staff approval screen, loan-history screen or alternative backend was invented.
