# Borrow and return implementation checkpoint

## Borrowing UI
- Google Sheets catalog with Drive photo previews, responsive cards and table view.
- Search, category counts, availability indicator and reset controls.
- Click an item to open the borrowing form with selected asset summary and sticky header.
- Read-only signed-in borrower name, team, editable purpose presets and Thai Mantine date picker.
- Initialize the borrowing date in Bangkok time; display a small warning for periods over seven days.
- Remove the seven-day submission limit while retaining date ordering validation.
- Clearing the form preserves the selected equipment.

## Requests and approval
- My requests shows equipment photos, borrower/team details, dates, remaining days and full details.
- User-specific query cache and private no-store responses; API filters by creator audit records.
- Admin/Super Admin approval page with separate borrowing/return tabs, status totals and colors.
- Status drafts require an explicit Save action; save responsible administrator and audit entry.
- Rejected/cancelled borrowing requests release availability without deleting history.

## Return flow
- Return selection is restricted to the signed-in creator and loans currently being borrowed.
- Store original loan and item IDs in return rows.
- Return statuses: pending, in progress, completed (Thai labels in code).
- Submitting a return updates the loan to waiting for return processing in the same Sheets batch.
- Reject duplicate return requests; completed returns close the loan.
- Require good/damaged condition on completion; only good equipment returns to availability.
- Live return-sheet dropdown validation was updated to the three statuses separately from Git.

## Other included work
- Restored dashboard IQI import and editable detail changes from stash on top of main.
- Shared rounded theme tokens and CSS updates.
- Exact-email Google login allowlist through GOOGLE_ALLOWED_EMAILS; verified Google tokens remain required.
- Internal-only Google OAuth audience still blocks external Gmail until Cloud configuration permits it.
- Added Mantine dates and dayjs dependencies.

## Validation and limits
- TypeScript checks passed during implementation.
- Focused tests cover callback allowlist, request privacy, availability, return eligibility and atomic Sheets writes.
- Full browser flow and production/live borrowing transactions have not been verified.
- The broader roleAccess integration test was observed failing at /api/status (403 versus expected 200).
- Older tests and live historical rows may still reference previous return labels.
- Local secret environment files are not included; Google Cloud and live sheet configuration are external to this commit.
