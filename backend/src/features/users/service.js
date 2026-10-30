import { randomUUID } from 'node:crypto';
import { currentUser, publicUser, soleSuperAdminId } from '../auth/repositories/user.repository.js';
import {
  hasPermission,
  ROLES,
  USER_STATUSES,
} from '../../../../shared/features/auth/permissions.js';
import { auditEntry } from '../audit/repository.js';
import { throwHttpError } from '../../core/errors/errors.js';
export class UserManagementService {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
  }
  async list(query = {}) {
    if (
      (query.role && !ROLES.includes(query.role)) ||
      (query.status && !USER_STATUSES.includes(query.status)) ||
      (query.search && (typeof query.search !== 'string' || query.search.length > 200))
    )
      throwHttpError(400, 'ตัวกรองผู้ใช้ไม่ถูกต้อง');
    const tables = await this.storage.read();
    const search = (query.search || '').toLowerCase();
    return [...new Set(tables.Users.map((user) => user.id))]
      .map((id) => publicUser(currentUser(tables, id)))
      .filter(
        (user) =>
          (!query.role || user.role === query.role) &&
          (!query.status || user.status === query.status) &&
          (!search || `${user.name} ${user.email}`.toLowerCase().includes(search)),
      );
  }
  async detail(id) {
    const tables = await this.storage.read();
    const user = publicUser(currentUser(tables, id));
    if (!user) throwHttpError(404, 'ไม่พบผู้ใช้');
    return user;
  }
  async update(actor, id, field, value) {
    if (
      (field === 'role' && !ROLES.includes(value)) ||
      (field === 'status' && !USER_STATUSES.includes(value)) ||
      !['role', 'status'].includes(field)
    )
      throwHttpError(400, 'Role หรือ Status ไม่ถูกต้อง');
    const tables = await this.storage.read();
    const currentActor = currentUser(tables, actor.id);
    if (currentActor?.status !== 'ACTIVE' || !hasPermission(currentActor, 'USER_MANAGE'))
      throwHttpError(403, 'คุณไม่มีสิทธิ์จัดการผู้ใช้');
    const before = currentUser(tables, id);
    if (!before) throwHttpError(404, 'ไม่พบผู้ใช้');
    const ownerId = soleSuperAdminId(tables);
    if (field === 'role' && value === 'SUPER_ADMIN' && id !== ownerId)
      throwHttpError(409, 'ระบบอนุญาต SUPER_ADMIN เฉพาะบัญชีหลักเพียงบัญชีเดียว');
    if (
      id === ownerId &&
      ((field === 'role' && value !== 'SUPER_ADMIN') || (field === 'status' && value !== 'ACTIVE'))
    )
      throwHttpError(409, 'ไม่สามารถลดสิทธิ์หรือปิดบัญชี SUPER_ADMIN หลักได้');
    if (before[field] === value) return publicUser(before);
    const now = new Date().toISOString();
    const operations = [];
    if (field === 'status') {
      for (const user of tables.Users.filter((user) => user.id === id))
        operations.push({
          table: 'Users',
          row: user.row,
          values: { status: value, updated_at: now },
        });
    } else {
      const grants = tables.Admins.filter((admin) => admin.user_id === id);
      for (const grant of grants)
        operations.push({
          table: 'Admins',
          row: grant.row,
          values: {
            role: value === 'STAFF' ? grant.role : value,
            status: value === 'STAFF' ? 'DISABLED' : 'ACTIVE',
            updated_at: now,
            assigned_by: actor.id,
          },
        });
      if (!grants.length && value !== 'STAFF')
        operations.push({
          table: 'Admins',
          values: {
            id: randomUUID(),
            user_id: id,
            email: before.email,
            role: value,
            status: 'ACTIVE',
            assigned_by: actor.id,
            created_at: now,
            updated_at: now,
          },
        });
    }
    operations.push(
      auditEntry(
        currentActor,
        field === 'role' ? 'USER_ROLE_CHANGED' : 'USER_STATUS_CHANGED',
        'User',
        id,
        { [field]: before[field] },
        { [field]: value },
      ),
    );
    await this.storage.write(operations);
    return this.detail(id);
  }
}
