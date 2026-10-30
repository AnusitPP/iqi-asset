import test from 'node:test';
import assert from 'node:assert/strict';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';
import { UserManagementService } from '../../backend/src/features/users/service.js';
import { TestAuthStorage } from '../helpers/authStorage.js';

test('only the bound bootstrap owner can hold SUPER_ADMIN, even under concurrent promotions', async () => {
  const storage = new TestAuthStorage();
  const config = { bootstrapSuperAdminEmail: 'owner@step.cmu.ac.th' };
  const sessions = new SheetSessionService(storage, config);
  const ownerToken = await sessions.login({
    sub: 'owner',
    email: config.bootstrapSuperAdminEmail,
    name: 'Owner',
  });
  const owner = (await sessions.read(ownerToken)).user;
  const tokens = await Promise.all(
    ['a', 'b'].map((sub) => sessions.login({ sub, email: `${sub}@step.cmu.ac.th`, name: sub })),
  );
  const users = await Promise.all(tokens.map((token) => sessions.read(token)));
  const management = new UserManagementService(storage, config);
  const attempts = await Promise.allSettled(
    users.map(({ user }) => management.update(owner, user.id, 'role', 'SUPER_ADMIN')),
  );
  assert.ok(
    attempts.every((result) => result.status === 'rejected' && result.reason.status === 409),
  );
  assert.equal(storage.tables.Admins.filter((grant) => grant.role === 'SUPER_ADMIN').length, 1);
  await management.update(owner, users[0].user.id, 'role', 'ADMIN');
  assert.equal((await sessions.read(tokens[0])).user.role, 'ADMIN');
  await assert.rejects(
    management.update(owner, owner.id, 'role', 'STAFF'),
    (error) => error.status === 409,
  );
  await assert.rejects(
    management.update(owner, owner.id, 'status', 'DISABLED'),
    (error) => error.status === 409,
  );
});

test('manual extra SUPER_ADMIN grant does not obtain owner permissions and config changes cannot bootstrap a second owner', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, {
    bootstrapSuperAdminEmail: 'owner@step.cmu.ac.th',
  });
  const ownerToken = await sessions.login({
    sub: 'owner',
    email: 'owner@step.cmu.ac.th',
    name: 'Owner',
  });
  const next = new SheetSessionService(storage, { bootstrapSuperAdminEmail: 'new@step.cmu.ac.th' });
  const token = await next.login({ sub: 'new', email: 'new@step.cmu.ac.th', name: 'New' });
  const user = (await next.read(token)).user;
  assert.equal(user.role, 'STAFF');
  await storage.write([
    {
      table: 'Admins',
      values: {
        id: 'manual',
        user_id: user.id,
        email: user.email,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        assigned_by: 'manual',
      },
    },
  ]);
  assert.equal((await next.read(token)).user.role, 'ADMIN');
  assert.ok(!(await next.read(token)).user.permissions.includes('*'));
  assert.equal((await next.read(ownerToken)).user.role, 'SUPER_ADMIN');
});
