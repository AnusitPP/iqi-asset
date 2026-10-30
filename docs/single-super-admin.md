# Single SUPER_ADMIN policy

The sole owner is the existing user ID bound to the BOOTSTRAP assignment in Admins. Account identity remains tied to verified Google sub, not a mutable email address. Once bound, changing BOOTSTRAP_SUPER_ADMIN_EMAIL cannot create a second owner.

Only that user can resolve to SUPER_ADMIN. Other SUPER_ADMIN assignments entered directly in Sheets resolve to ADMIN; conflicting bootstrap identities fail closed. The Users API rejects attempts to promote any other account to SUPER_ADMIN and still prevents demoting or disabling the owner. This rule does not depend on a process-local count/lock, so concurrent promotion requests cannot create another owner.

The Users UI offers STAFF/ADMIN for other users and displays the owner's SUPER_ADMIN role/status as locked. The SUPER_ADMIN filter remains available for finding the owner. No existing user profiles or grants were deleted. Ownership transfer is not provided by this change.
