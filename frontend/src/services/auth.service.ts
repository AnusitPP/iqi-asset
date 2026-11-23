import { ApiClient } from '@/lib/api-client';
import { z } from 'zod';
import { authResultSchema, sessionSchema } from '@/types/contracts';

export const authService = {
  async resetCurrentSession() {
    const api = new ApiClient();
    const { csrf } = await api.request('/api/auth/recovery', z.object({ csrf: z.string().min(1) }));
    api.setCsrfToken(csrf);
    await api.request('/api/auth/reset', authResultSchema, { method: 'POST' });
  },
  fetchAuthSession(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/auth/me', sessionSchema, { signal });
  },
  logoutCurrentSession(api: ApiClient) {
    return api.request('/api/auth/logout', authResultSchema, { method: 'POST' });
  },
};
