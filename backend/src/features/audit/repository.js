import { randomUUID } from 'node:crypto';
export function auditEntry(actor, action, entityType, entityId = '', before = null, after = null) {
  return {
    table: 'AuditLogs',
    values: {
      id: randomUUID(),
      actor_user_id: actor?.id || '',
      actor_google_sub: actor?.google_sub || '',
      actor_name_snapshot: actor?.name || '',
      actor_email_snapshot: actor?.email || '',
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: before === null ? '' : JSON.stringify(before),
      after_data: after === null ? '' : JSON.stringify(after),
      created_at: new Date().toISOString(),
    },
  };
}
