import type { ApiClient } from '@/lib/api-client';
import { authResultSchema, sessionSchema } from '@/types/contracts';

export const authService = {
  fetchAuthSession(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/auth/me', sessionSchema, { signal });
  },
  logoutCurrentSession(api: ApiClient) {
    return api.request('/api/auth/logout', authResultSchema, { method: 'POST' });
  },
};
