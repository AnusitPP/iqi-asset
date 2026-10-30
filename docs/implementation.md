# IQI Asset Checker

> Historical implementation plan for the retired Vanilla frontend. The current application uses `apps/web`; see [architecture](architecture.md) and [deployment](vercel-deployment.md).

Approved scope: the user's full pasted specification, with the light Figma Community visual language. Only cross-sheet asset-number search and IQI row editing. Express, HTML/CSS/Vanilla JS, googleapis, dotenv. No deployment or database.

Implementation sequence:

- [x] Inspect workspace, protect credentials, install dependencies, attempt real connection.
- [x] Implement normalization, per-sheet full-number then final-two-segment matching, dynamic full-row schema and Bangkok date tests.
- [x] Implement Google API adapter, server-side revision snapshots, IQI-only changed-cell writes and readback.
- [x] Implement responsive search, grouped results, full-row detail/edit panel, today shortcut, loading/empty/error states.
- [x] Test APIs with an injected Sheets adapter, test browser at 360/390/430px and desktop, run checks.
- [x] Connect to converted native Google Sheet, inspect real headers, verify real search/read/save, document local/LAN usage.

Resolved external blocker: original spreadsheet was an Office document. User supplied native Google Sheets ID `1IvDnE8yCqN232ZuaXgNSj-42Zm4k1IjDYFNgsXXWdHo`. Real tab names mapped through config without renaming them. IQI contains inspection dates in หมายเหตุ, so the today shortcut preserves note text and replaces its inspection date. No fabricated runtime records or localStorage writes.

Concurrency: compare fresh header and full-row values/formulas before changed-cell updates. Reject moved, modified or indistinguishable duplicate rows. Google Sheets has no atomic conditional values update; an external edit in the narrow read/write interval remains possible. Serialize app writes, preserve untouched cells/formulas and verify readback.

Verification 2026-10-20:

- npm test: 10 passed; npm run check passed; npm audit: 0 vulnerabilities.
- Live search STeP64-107-002 returned one distinct record per sheet; sample STeP61-207-007 correctly returned 0 in each.
- Live full row reads: IQI 15 columns, รายการทั้งหมด 16, all 12, including blank/unnamed fields.
- Reversible real API note write passed direct Google readback, rejected a non-IQI target, restored original, and all three full-sheet snapshots matched the initial state.
- Browser mobile today shortcut and Save wrote 20/10/2569 in หมายเหตุ; verified persisted value, then restored original whole row. No test data left behind.
- Browser verified 360/390/430px without horizontal overflow; 360px edit form has all 15 editable fields and pinned actions. Readonly view has 16 fields, zero textareas, zero save buttons.
- Reviewer identified textarea CRLF normalization risking untouched formula overwrite; fixed using original strings for fields unchanged from normalized UI baselines, with regression test.
- Browser console: zero errors. Localhost and 192.168.1.94 /api/status returned connected. Physical handset not available; LAN binding tested from this machine.
- Screenshots: test-results/desktop.png. README includes launch instructions, configuration, schema mapping, LAN/firewall and concurrency limits.

Dropdown update 2026-10-20 (user requested):

- Read per-cell Google Sheets dataValidation for IQI rows, including ONE_OF_LIST and referenced ONE_OF_RANGE options. Strict choices use select; warning-only lists retain editable suggestions. Plain fields remain textareas, and legacy values are preserved.
- Fetch latest rules before write; reject invalid changed strict values with 422. Real row2 exposes 7 dropdowns + 8 textareas. Invalid real API request rejected and row verified unchanged.
- Browser verified choice changes enable Save, restoring the original choice disables it; 390px controls styled correctly. No live data writes during this update.
- npm test: 16 passed; syntax checks passed; independent read-only review found no important actionable bugs.
- Screenshot: test-results/dropdowns-mobile.png.

Password update (user explicitly chose 1234):

- Password popup with server-side authentication for every data API. In-memory 8-hour sessions, HttpOnly/SameSite cookies, scrypt comparison, same-origin/CSRF checks and five-failure one-minute IP lockout. Password configured in ignored .env, not frontend.
- Login, incorrect password, authenticated live search, logout/reload and 360px popup verified in browser. Escape cannot dismiss the locked popup. API tests verify no unauthenticated data reads/writes and server-side session expiry.
- Reviewer lockout timing finding fixed: the full minute starts at the fifth failure, covered with simulated clock test.
- npm test: 21 passed; syntax checks and authenticated live search/read script passed. No Sheet data writes for this change.
- Screenshot: test-results/password-popup.png.

Pending-heart update (user approved):

- Added สถานะการค้นหา at P1 in IQI, single-value dropdown รอค้นหา / blank; existing columns, formulas, row order and both readonly sheets verified unchanged against private pre-change snapshot. Repeated schema check and restart create no duplicate.
- IQI SVG heart writes status through authenticated revision-checked API and changes appearance only after real Google readback. Full edit form also exposes new column dynamically.
- Checkbox intersects the current asset-number search; checked with empty query lists all marked IQI records. No sorting or unrelated records.
- Browser: marked row2, directly verified Google P2=รอค้นหา, tested matching/unrelated/blank queries, checked 360px geometry, unmarked to restore blank. No test markers remain.
- 26 tests pass, including stale/moved/forged requests, schema idempotence and >2000 matching IQI rows. Reviewer token-budget finding fixed by retaining all tokens in a current result set. Syntax checks pass.
- Screenshot: test-results/pending-heart-mobile.png.

Review queue update:

- All three sources expose the heart. Selection copies nine requested fields to the existing empty รอตรวจสอบ tab (gid 229028462); source headers are matched through aliases. Missing fields stay blank. Original equipment descriptions remain unchanged.
- IQI status and queue changes share one Google batch. Readonly source cells are never changed. Repeated selection is idempotent; different source sheets retain separate identities. Unselection clears only the linked queue copy. IQI edits through the app refresh selected copies.
- Target header is validated; formulas that display an empty string prevent initialization or blank-row reuse. Technical links are hidden in J:L; extra columns are preserved.
- 33 tests pass, syntax checks pass. Real Google copy fields matched the source snapshot. Test cleanup confirmed all three original sheets equal the pre-feature snapshot. Browser verified selection from all, checkbox filtering, direct target link and 360px layout without horizontal overflow; test selection removed afterward.
- External edits to original Sheet cells do not automatically refresh queued snapshots. External sorting during the check/write interval remains a Google API limitation.
- Screenshot: test-results/review-queue-mobile.png.

Serial search update:

- The existing search input now matches asset number OR S/N, including partial text and case normalization, across all three sheets. Matching both columns returns one row. Existing asset suffix fallback is retained only when no primary matches exist.
- Serial header aliases: Serial Number (S/N), Serial Number, S/N, SN, Serial No. Missing serial columns remain supported. Search labels and empty messages describe both identifiers.
- 34 tests pass and syntax checks pass; real serial samples from each source matched the correct row without any Sheet writes.

Review date update:

- Added visible M วันที่แก้ไข, native date/time formatted dd/mm/yyyy hh:mm:ss. New heart selections get Bangkok wall time; repeated selection preserves the timestamp. Subsequent app edits refresh timestamps only for previously dated entries. Existing 38 entries remain blank; source sheets and review row order preserved.
- Header migration is idempotent, preserves extra occupied columns by insertion, and keeps J:L hidden. Startup skips already linked legacy entries to avoid redundant Google read requests.
- 37 tests pass and syntax checks pass. Real reversible copy verified formatted Bangkok date; test removed and entire review data matched its prior snapshot. No frontend UI changes.

Separate inspection workflow (supersedes heart timestamps):

- Heart and generic IQI edits update only A:L; neither stamps inspection dates. Existing dates are preserved. Unselection clears A:N with the linked copy.
- Pending cards expose บันทึกผลตรวจ, a mobile dialog with ดี / ชำรุด / หาไม่เจอ. Saving changes N สถานะการตรวจสอบ and M วันที่แก้ไข in the existing queue row atomically; unchanged status leaves the timestamp unchanged. No original source fields are edited.
- Authenticated GET/PUT /api/review-inspection check source snapshot plus queue-row revision, serialize changes, reject stale/invalid requests, and read back both saved fields. Column N has a strict three-option dropdown. Direct edits in Google Sheets do not auto-stamp dates.
- 40 tests pass; syntax checks pass. Real reversible test confirmed blank date after heart, actual status/date write, cleanup, and exact preservation of all existing queue rows and source sheets. Mobile dialog verified at 360px. Reviewer found no important issues.
- Screenshot: test-results/inspection-form-mobile.png.

Two-tab queue routing:

- New heart copies route to IQI + IT only for team IQI with full name IT or truly blank. Other teams/owners route to รอตรวจสอบ. Coordinator locates existing entries across both tabs before writing; duplicated links across tabs reject rather than guess. Both tabs support status/date/colors and removal; primary-only maintenance APIs remain unchanged.
- User explicitly requested historical completed rows moved too. Atomic migration moved six unique completed entries and merged eleven reintroduced blank duplicates into existing destination entries, keeping recorded destination results. Final migration counts: primary 47, secondary 27. All original sheets and full row/date/status data verified preserved; private backup retained.
- Search batch-reads both destinations. Secondary entries appear under a separate IT + IQI group; every card retains sourceSheet for details, heart and inspection requests. Destination text and separate Sheet link are shown. Startup backfill checks keys across both tabs.
- 43 tests pass including routed selection, no duplicate on repeat, secondary inspection/date, IQI edit preserving secondary status, removal, normal-team routing, stale/cross-tab conflicts. Real reversible new selection appeared under fourth group and authenticated inspection updated the secondary tab. Test copy removed; both queues and all sources exactly matched the pre-test snapshot. Review found no important issues.
