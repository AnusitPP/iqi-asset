# Organization authentication and authorization

Continue on codex/google-auth. Google redirect/callback and profile already exist. Target persistence is Google Sheets, per the user’s later explicit instruction overriding the original PostgreSQL preference. Use the separate Admin_database workbook for users, opaque hashed session tokens and audit. Preserve existing CSRF/host checks and Sheets/Drive adapters. No authentication data belongs in Sheets. No client tokens in web storage.

Google sub is unique identity; new users default STAFF. Only the configured bootstrap email can initialize the first active SUPER_ADMIN, with the bootstrap account protected against demotion/deactivation. Subsequent logins never re-promote downgraded users. Role and ACTIVE status are read on every protected request. User updates and their audit records commit together, while protecting the immutable bootstrap SUPER_ADMIN.

Session tokens contain 32 cryptographically random bytes, are stored only as SHA-256 hashes, expire after 30 minutes and are revoked in the shared Sessions table on logout. Cookie is HttpOnly, SameSite=Lax, Secure in production; HTTP localhost is supported for development. Auth storage unavailable means protected APIs fail closed.

Central shared permissions define STAFF/ADMIN/SUPER_ADMIN. Backend checks all routes; browser only adapts presentation. User management and audit routes run before Sheets readiness because they do not depend on Sheets. STAFF sees its own requests using immutable user IDs, never names/emails. Existing unowned historical records are admin-only.

User selected Google Sheets. Bootstrap email: apanpimsen@step.cmu.ac.th. Auth spreadsheet ID: 1DBixPNtSNPjfOabU-XI0qEpTy1sTeUcC73V8Z4F9kek. Existing blank workbook was prepared with Users (profile/status), Admins (elevated role assignment), Sessions (hash/expiry/revocation), AuditLogs (actor/action/before/after). Users.role is derived: STAFF unless an ACTIVE Admins assignment matches the verified internal user ID. Admins has one PENDING bootstrap invitation; user_id stays empty until a real verified login supplies Google sub. No user profile or session has been fabricated.

Current checkpoint: tables are prepared and read back; permission helpers and their tests exist, but auth/session repositories, API enforcement and user-management UI are not wired yet. Existing login continues using its previous session implementation. The previously prepared unused SQL migration was removed. Google Sheets has no database uniqueness/conditional transaction guarantees; the persistence design still needs to address concurrent mutations before claiming production readiness. Never treat a memory mutex as a cross-instance solution. Do not deploy production implicitly.


Update: Sheet integration is now implemented; see auth-sheets.md for the actual modules, routes, verification and remaining workflow/transaction limits.
