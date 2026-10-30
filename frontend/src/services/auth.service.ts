import type { ApiClient } from '@/lib/api-client';
import { authResultSchema, sessionSchema } from '@/types/contracts';

export const authService = {
  fetchAuthSession(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/auth/session', sessionSchema, { signal });
  },
  loginWithPassword(api: ApiClient, password: string) {
    return api.request('/api/auth/login', authResultSchema, { method: 'POST', body: { password } });
  },
  logoutCurrentSession(api: ApiClient) {
    return api.request('/api/auth/logout', authResultSchema, { method: 'POST' });
  },
};
