export function filterAuditEntries(records, { query = '', action = '', type = '' } = {}) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(
    (entry) =>
      (!action || entry.action === action) &&
      (!type || entry.entity_type === type) &&
      terms.every((term) =>
        [
          entry.actor_name_snapshot,
          entry.actor_email_snapshot,
          entry.entity_id,
          entry.action,
          entry.entity_type,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(term),
        ),
      ),
  );
}
export function auditActionTone(action) {
  if (/FAILED|REJECTED|DISABLED/.test(action)) return 'danger';
  if (/SUCCESS|APPROVED|ACCEPTED|CREATED/.test(action)) return 'success';
  if (/CHANGED|ASSIGNED/.test(action)) return 'update';
  return 'neutral';
}
