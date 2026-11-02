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
