import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionsForRole, hasPermission } from '../../shared/features/auth/permissions.js';
import { requirePermission } from '../../backend/src/features/auth/middleware/require-permission.js';

test('roles grant only their defined capabilities; unknown role fails closed', () => {
  const user = role => ({ permissions: permissionsForRole(role) });
  assert.equal(hasPermission(user('STAFF'), 'LOAN_CREATE'), true);
  assert.equal(hasPermission(user('STAFF'), 'USER_MANAGE'), false);
  assert.equal(hasPermission(user('ADMIN'), 'ASSET_EDIT'), true);
  assert.equal(hasPermission(user('ADMIN'), 'USER_MANAGE'), false);
  assert.equal(hasPermission(user('SUPER_ADMIN'), 'USER_MANAGE'), true);
  assert.equal(hasPermission(user('unknown'), 'ASSET_VIEW'), false);
  const permissions = permissionsForRole('STAFF');
  permissions.push('*');
  assert.equal(hasPermission(user('STAFF'), 'USER_MANAGE'), false);
});
test('permission middleware rejects anonymous and forbidden requests', () => {
  const guard = requirePermission('USER_MANAGE');
  assert.throws(() => guard({}, {}, () => {}), e => e.status === 401);
  assert.throws(() => guard({ user: { permissions: permissionsForRole('ADMIN') } }, {}, () => {}), e => e.status === 403);
  let passed = false;
  guard({ user: { permissions: ['*'] } }, {}, () => { passed = true; });
  assert.equal(passed, true);
});
