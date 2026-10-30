import type { ApiClient } from '@/lib/api-client';
import { statusSchema } from '@/types/contracts';

export const systemService = {
  fetchConnectionStatus(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/status', statusSchema, { signal });
  },
};
