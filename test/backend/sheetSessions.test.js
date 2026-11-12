import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SheetSessionService,
  sessionHash,
} from '../../backend/src/features/auth/services/session.service.js';
import { UserManagementService } from '../../backend/src/features/users/service.js';
import { TestAuthStorage } from '../helpers/authStorage.js';
const config = { bootstrapSuperAdminEmail: 'owner@step.cmu.ac.th' };
const identity = { sub: 'staff-google-sub', name: 'Staff', email: 'staff@step.cmu.ac.th' };

test('user management reports latest own activity across sessions without exposing session data', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, config);
  await sessions.login(identity);
  const id = storage.tables.Users[0].id;
  storage.tables.Users[0].last_login_at = '2026-11-12T01:00:00Z';
  storage.tables.Sessions = [
    { user_id: id, last_seen_at: '2026-11-12T01:05:00Z', session_token_hash: 'secret' },
    { user_id: id, last_seen_at: '2026-11-12T01:10:00Z', revoked_at: '2026-11-12T01:11:00Z' },
    { user_id: id, last_seen_at: 'invalid' },
    { user_id: 'other-user', last_seen_at: '2026-11-12T02:00:00Z' },
  ];
  const service = new UserManagementService(storage, config);
  const user = await service.detail(id);
  assert.equal(user.last_seen_at, '2026-11-12T01:11:00.000Z');
  assert.equal((await service.list())[0].last_seen_at, user.last_seen_at);
  assert.equal(user.session_token_hash, undefined);
  storage.tables.Sessions = [];
  assert.equal((await service.detail(id)).last_seen_at, '2026-11-12T01:00:00.000Z');
});

test('sessions last 30 minutes and old eight-hour sessions are capped from original creation', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, config);
  const token = await sessions.login(identity);
  const record = storage.tables.Sessions[0];
  const duration = Date.parse(record.expires_at) - Date.parse(record.created_at);
  assert.ok(duration >= 30 * 60 * 1000 && duration < 30 * 60 * 1000 + 1000);
  record.created_at = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  record.expires_at = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
  assert.equal(await sessions.read(token), null);
});

test('new users persist as STAFF, session stores only hash, revocation works in another instance', async () => {
  const storage = new TestAuthStorage();
  const a = new SheetSessionService(storage, config),
    b = new SheetSessionService(storage, config);
  const token = await a.login(identity);
  assert.equal((await b.read(token)).user.role, 'STAFF');
  assert.equal(storage.tables.Sessions[0].session_token_hash, sessionHash(token));
  assert.ok(!JSON.stringify(storage.tables).includes(token));
  assert.equal(storage.tables.AuditLogs[0].action, 'LOGIN_SUCCESS');
  await b.logout(token);
  assert.equal(await a.read(token), null);
  assert.equal(storage.tables.AuditLogs.at(-1).action, 'LOGOUT');
});
test('bootstrap binds verified sub, changes roles immediately, audits mutation and protects anchor', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, config);
  const ownerToken = await sessions.login({
    ...identity,
    sub: 'owner-sub',
    email: config.bootstrapSuperAdminEmail,
  });
  const owner = (await sessions.read(ownerToken)).user;
  assert.equal(owner.role, 'SUPER_ADMIN');
  const token = await sessions.login(identity);
  const staff = (await sessions.read(token)).user;
  const users = new UserManagementService(storage, config);
  await users.update(owner, staff.id, 'role', 'ADMIN');
  assert.equal((await sessions.read(token)).user.role, 'ADMIN');
  await users.update(owner, staff.id, 'role', 'STAFF');
  assert.equal((await sessions.read(token)).user.role, 'STAFF');
  const grant = storage.tables.Admins.find((entry) => entry.user_id === staff.id);
  assert.equal(grant.role, 'STAFF');
  assert.equal(grant.status, 'DISABLED');
  assert.equal((await sessions.read(token)).user.status, 'ACTIVE');
  await users.update(owner, staff.id, 'role', 'ADMIN');
  assert.equal(grant.role, 'ADMIN');
  assert.equal(grant.status, 'ACTIVE');
  assert.equal((await sessions.read(token)).user.role, 'ADMIN');
  await users.update(owner, staff.id, 'role', 'STAFF');
  await users.update(owner, staff.id, 'status', 'DISABLED');
  assert.equal(await sessions.read(token), null);
  await assert.rejects(sessions.login(identity), (e) => e.status === 403);
  await assert.rejects(users.update(owner, owner.id, 'role', 'STAFF'), (e) => e.status === 409);
  await assert.rejects(
    users.update(owner, owner.id, 'status', 'DISABLED'),
    (e) => e.status === 409,
  );
  assert.ok(storage.tables.AuditLogs.some((entry) => entry.action === 'USER_ROLE_CHANGED'));
});
test('expired, tampered sessions fail closed and an email cannot take another Google identity', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, config);
  const token = await sessions.login(identity);
  await assert.rejects(
    sessions.login({ ...identity, sub: 'different-sub' }),
    (e) => e.status === 409,
  );
  assert.equal(await sessions.read(token + 'x'), null);
  storage.tables.Sessions[0].expires_at = '2000-01-01T00:00:00Z';
  assert.equal(await sessions.read(token), null);
});
test('login profile refresh does not reset an existing ADMIN role or disabled duplicate', async () => {
  const storage = new TestAuthStorage();
  const sessions = new SheetSessionService(storage, config);
  const ownerToken = await sessions.login({
    ...identity,
    sub: 'owner-sub',
    email: config.bootstrapSuperAdminEmail,
  });
  const owner = (await sessions.read(ownerToken)).user;
  let token = await sessions.login(identity);
  const id = (await sessions.read(token)).user.id;
  await new UserManagementService(storage, config).update(owner, id, 'role', 'ADMIN');
  token = await sessions.login({ ...identity, name: 'Updated' });
  assert.equal((await sessions.read(token)).user.role, 'ADMIN');
  assert.equal((await sessions.read(token)).user.name, 'Updated');
  storage.tables.Users.push({
    ...storage.tables.Users.find((user) => user.id === id),
    row: 3,
    status: 'DISABLED',
  });
  assert.equal(await sessions.read(token), null);
});
