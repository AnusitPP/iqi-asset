import type { ApiClient } from '@/lib/api-client';
import { myRequestsSchema } from '@/types/account';
export const myRequestsService = {
  list(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/my-requests', myRequestsSchema, { signal });
  },
};
