import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAuditEntries,
  auditActionTone,
} from '../../frontend/public/js/features/audit/model.js';
const entries = [
  {
    actor_name_snapshot: 'Anusit Panpimsen',
    actor_email_snapshot: 'owner@step.cmu.ac.th',
    entity_id: 'session-01',
    action: 'LOGIN_SUCCESS',
    entity_type: 'Session',
  },
  {
    actor_name_snapshot: 'Somchai',
    actor_email_snapshot: 'staff@step.cmu.ac.th',
    entity_id: 'user-02',
    action: 'USER_ROLE_CHANGED',
    entity_type: 'User',
  },
  { action: 'LOGIN_FAILED', entity_type: 'Authentication', entity_id: '' },
];
test('audit search combines case-insensitive terms with exact action and type filters', () => {
  assert.deepEqual(filterAuditEntries(entries, { query: 'ANUSIT session-01' }), [entries[0]]);
  assert.deepEqual(
    filterAuditEntries(entries, { query: 'staff@step', type: 'User', action: 'USER_ROLE_CHANGED' }),
    [entries[1]],
  );
  assert.deepEqual(filterAuditEntries(entries, { query: 'staff', action: 'LOGIN_SUCCESS' }), []);
  assert.deepEqual(filterAuditEntries(entries, { query: '   ' }), entries);
  assert.deepEqual(filterAuditEntries(entries, { type: 'Authentication' }), [entries[2]]);
  assert.equal(entries.length, 3);
});
test('audit badges distinguish rejection, success and updates with a neutral fallback', () => {
  assert.equal(auditActionTone('LOGIN_FAILED'), 'danger');
  assert.equal(auditActionTone('LOGIN_SUCCESS'), 'success');
  assert.equal(auditActionTone('USER_ROLE_CHANGED'), 'update');
  assert.equal(auditActionTone('LOGOUT'), 'neutral');
});
