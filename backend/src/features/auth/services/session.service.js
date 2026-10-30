import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { SESSION_LIFETIME_MS } from '../../../core/config/session.config.js';
import { throwHttpError } from '../../../core/errors/errors.js';
import {
  currentUser,
  userIdForGoogleSub,
  soleSuperAdminId,
} from '../repositories/user.repository.js';
import { auditEntry } from '../../audit/repository.js';
export const sessionHash = (token) => createHash('sha256').update(token).digest('hex');
export class SheetSessionService {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
  }
  async read(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const tables = await this.storage.read();
    const matches = tables.Sessions.filter(
      (session) => session.session_token_hash === sessionHash(token),
    );
    if (
      !matches.length ||
      matches.some(
        (session) =>
          session.revoked_at ||
          !Number.isFinite(Date.parse(session.expires_at)) ||
          Date.parse(session.expires_at) <= Date.now() ||
          !Number.isFinite(Date.parse(session.created_at)) ||
          Date.parse(session.created_at) + SESSION_LIFETIME_MS <= Date.now(),
      )
    )
      return null;
    const session = matches[0];
    if (matches.some((match) => match.user_id !== session.user_id)) return null;
    const user = currentUser(tables, session.user_id);
    if (!user || user.status !== 'ACTIVE') return null;
    if (!session.last_seen_at || Date.now() - Date.parse(session.last_seen_at) > 5 * 60 * 1000)
      await this.storage.write(
        matches.map((match) => ({
          table: 'Sessions',
          row: match.row,
          values: { last_seen_at: new Date().toISOString() },
        })),
      );
    return { session, user };
  }
  async login(identity, oldToken) {
    const tables = await this.storage.read();
    const id = userIdForGoogleSub(identity.sub);
    const email = identity.email.toLowerCase();
    if (
      tables.Users.some(
        (user) => user.email.toLowerCase() === email && user.google_sub !== identity.sub,
      )
    )
      throwHttpError(409, 'อีเมลนี้ผูกกับบัญชี Google อื่น กรุณาติดต่อผู้ดูแล');
    const existing = currentUser(tables, id);
    if (existing?.status === 'DISABLED') {
      await this.storage.write([
        auditEntry(existing, 'LOGIN_FAILED', 'User', id, null, { reason: 'DISABLED' }),
      ]);
      throwHttpError(403, 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล');
    }
    const now = new Date().toISOString();
    const profile = {
      id,
      google_sub: identity.sub,
      email,
      name: identity.name,
      avatar_url: identity.avatar_url || '',
      last_login_at: now,
      updated_at: now,
    };
    const operations = existing
      ? tables.Users.filter((user) => user.id === id).map((user) => ({
          table: 'Users',
          row: user.row,
          values: {
            email,
            name: profile.name,
            avatar_url: profile.avatar_url,
            last_login_at: now,
            updated_at: now,
          },
        }))
      : [{ table: 'Users', values: { ...profile, status: 'ACTIVE', created_at: now } }];
    const ownerId = soleSuperAdminId(tables);
    if (email === this.config.bootstrapSuperAdminEmail && (!ownerId || ownerId === id)) {
      const grants = tables.Admins.filter((admin) => admin.email.toLowerCase() === email);
      if (grants.some((admin) => admin.user_id && admin.user_id !== id))
        throwHttpError(403, 'บัญชี bootstrap ผูกกับ Google identity อื่นแล้ว');
      if (!grants.length)
        operations.push({
          table: 'Admins',
          values: {
            id: randomUUID(),
            user_id: id,
            email,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            assigned_by: 'BOOTSTRAP',
            created_at: now,
            updated_at: now,
          },
        });
      for (const grant of grants.filter((admin) => admin.status === 'PENDING' && !admin.user_id))
        operations.push({
          table: 'Admins',
          row: grant.row,
          values: { user_id: id, role: 'SUPER_ADMIN', status: 'ACTIVE', updated_at: now },
        });
    }
    const token = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    operations.push({
      table: 'Sessions',
      values: {
        id: sessionId,
        user_id: id,
        session_token_hash: sessionHash(token),
        created_at: now,
        expires_at: new Date(Date.now() + SESSION_LIFETIME_MS).toISOString(),
        last_seen_at: now,
      },
    });
    if (typeof oldToken === 'string')
      for (const previous of tables.Sessions.filter(
        (session) => session.session_token_hash === sessionHash(oldToken) && !session.revoked_at,
      ))
        operations.push({ table: 'Sessions', row: previous.row, values: { revoked_at: now } });
    operations.push(auditEntry(profile, 'LOGIN_SUCCESS', 'Session', sessionId));
    await this.storage.write(operations);
    return token;
  }
  async logout(token) {
    const active = await this.read(token);
    if (!active) return;
    const tables = await this.storage.read();
    const operations = tables.Sessions.filter(
      (session) => session.session_token_hash === sessionHash(token),
    ).map((session) => ({
      table: 'Sessions',
      row: session.row,
      values: { revoked_at: new Date().toISOString() },
    }));
    operations.push(auditEntry(active.user, 'LOGOUT', 'Session', active.session.id));
    await this.storage.write(operations);
  }
  async failedLogin() {
    await this.storage.write([auditEntry(null, 'LOGIN_FAILED', 'Authentication')]);
  }
}
