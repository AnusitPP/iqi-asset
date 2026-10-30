# Authentication backed by Google Sheets

## Configuration
Set AUTH_SPREADSHEET_ID to the separate private workbook shared with the existing server service account as Editor. Set BOOTSTRAP_SUPER_ADMIN_EMAIL to the verified organization account selected by the owner. Google login still uses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ALLOWED_DOMAIN and optional APP_URL. Keep APP_SECRET for stable CSRF across Vercel instances. Never publish the auth workbook or expose its API to the browser. Google user OAuth and the storage service-account credentials stay separate.

Current configured workbook: https://docs.google.com/spreadsheets/d/1DBixPNtSNPjfOabU-XI0qEpTy1sTeUcC73V8Z4F9kek/edit

## Storage schema
Users: id, google_sub, email, name, avatar_url, status, last_login_at, created_at, updated_at.
Admins: id, user_id, email, role, status, assigned_by, created_at, updated_at.
Sessions: id, user_id, session_token_hash, created_at, expires_at, revoked_at, last_seen_at.
AuditLogs: id, actor_user_id, actor_google_sub, actor_name_snapshot, actor_email_snapshot, action, entity_type, entity_id, before_data, after_data, created_at.

User IDs are derived deterministically from verified Google sub; email is not identity. A new user defaults STAFF. Active elevated grants live only in Admins, linked by user_id. The pending bootstrap invitation binds to a verified identity on first login. Roles/status are reread on every authenticated request. Duplicate profiles with any disabled row fail closed; conflicting elevated assignments resolve to the lower privilege. Do not reorder/delete data rows while the application is writing.

Profile, bootstrap grant, session and login audit are written together using a Sheets batchUpdate. Profile refresh patches only profile/date fields, preserving any concurrent status change. Sessions are 32 random bytes in a HttpOnly cookie, only their SHA-256 hash is stored. They expire after 30 minutes; cookie SameSite=Lax, Secure when hosted. last_seen_at refreshes at most once every 5 minutes. Logout writes revocation and audit before clearing the cookie. Revocation is visible to other instances without a process cache.

## Modules
integrations/google/auth-storage.js handles Sheets transport/schema validation. auth/repositories/user.repository.js resolves identity and role; auth/services/session.service.js implements login/session/revocation; controllers/session.controller.js handles cookies/responses. sheet.middleware.js composes these separately from the existing legacy auth middleware used by older isolated test fixtures. Real configured Google deployments use sheet.middleware and reject password POST with 410. Missing AUTH_SPREADSHEET_ID with configured Google credentials fails startup instead of falling back.

shared/features/auth/permissions.js defines permissions; auth/middleware/protect-api.js enforces the existing API surface before handlers. Users routes/controller/service handle listing/detail and audited role/status changes. Audit routes expose authentication/user-management history only to USER_MANAGE holders; ADMIN sees operational audit only. The permanently protected bootstrap anchor ensures there is an active SUPER_ADMIN even across concurrent last-admin mutations; its role/status cannot be reduced from the UI/API.

Frontend auth/permissions.js applies permission-based menus, profile and readonly requester names. adminUsers/, audit/ and myRequests/ own their respective pages. app.js only composes these. Asset editing is denied on the server for STAFF, detail/search editable flags are masked, and inspection actions are hidden. Loan/return requester name and idempotency namespace are bound to the authenticated user. Own requests are resolved by immutable actor_user_id audit links, never by a display name. Historical records without ownership remain unavailable in My Requests.

## Routes
GET /api/auth/google and /api/auth/google/callback: Google identity verification.
GET /api/auth/session and /api/auth/me: current safe user/permissions plus CSRF.
POST /api/auth/logout: persistent revoke.
POST /api/auth/login: 410 in configured Sheet mode.
GET /api/admin/users?search=&role=&status= and /api/admin/users/:id.
PATCH /api/admin/users/:id/role and /api/admin/users/:id/status (USER_MANAGE).
GET /api/audit: latest 200 permitted events.
GET /api/my-requests: current user's linked loan/return requests.

## Verification
STAFF: sign in with a second real permitted organization account; new account must have STAFF, no Users/Admin Dashboard/Audit menu, and direct management endpoints must return 403.
ADMIN: SUPER_ADMIN changes that user's role through Users; next API request must honor ADMIN permissions, while Users management stays forbidden.
SUPER_ADMIN: bootstrap login creates/binds the configured owner, Users can search/detail and update other profiles, role/status changes must have audit entries. Attempted bootstrap demotion/deactivation must return 409.
Tests cover cross-instance revocation, expiration, wrong identity/email reuse, fresh role/status enforcement, protected bootstrap and API permissions. Do not invent a Google sub in live data to test roles.

## Current limits
This connects authentication, users, permission gates and audit; it does not add the separate loan-approval/rejection/responsible-assignment/return-acceptance workflow. Existing hosted loan/return writes retain their single-server restriction. Audit action types for those future workflows should be emitted only when those actions are actually implemented. Ownership audit append and business-ledger writes span separate workbooks; retry the same request ID after an uncertain response.

Sheets has API quotas and no conditional writes, uniqueness constraints or database row locks. The immutable bootstrap anchor protects last-admin availability; duplicate safe identity resolution limits registration races, but this is not a substitute for relational transactional guarantees. Protect the workbook from manual row deletion/reordering and use a real database when concurrency/scale needs it. No production deployment was performed by this change.
