import type { ApiClient } from '@/lib/api-client';
import { auditSchema } from '@/types/account';
export const auditService = {
  list(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/audit', auditSchema, { signal });
  },
};
