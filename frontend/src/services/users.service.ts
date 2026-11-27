import type { ApiClient } from '@/lib/api-client';
import {
  usersSchema,
  userDetailSchema,
  type AccountRole,
  type AccountStatus,
} from '@/types/account';
export const usersService = {
  list(
    api: ApiClient,
    filters: { search: string; role: string; status: string },
    signal?: AbortSignal,
  ) {
    return api.request('/api/admin/users?' + new URLSearchParams(filters), usersSchema, { signal });
  },
  detail(api: ApiClient, id: string, signal?: AbortSignal) {
    return api.request(`/api/admin/users/${encodeURIComponent(id)}`, userDetailSchema, { signal });
  },
  updatePermissions(api: ApiClient, id: string, permissions: string[]) {
    return api.request(`/api/admin/users/${encodeURIComponent(id)}/permissions`, userDetailSchema, {
      method: 'PATCH',
      body: { permissions },
    });
  },
  updateRole(api: ApiClient, id: string, role: AccountRole) {
    return api.request(`/api/admin/users/${encodeURIComponent(id)}/role`, userDetailSchema, {
      method: 'PATCH',
      body: { role },
    });
  },
  updateStatus(api: ApiClient, id: string, status: AccountStatus) {
    return api.request(`/api/admin/users/${encodeURIComponent(id)}/status`, userDetailSchema, {
      method: 'PATCH',
      body: { status },
    });
  },
};
