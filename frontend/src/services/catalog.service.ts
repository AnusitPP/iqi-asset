import type { ApiClient } from '@/lib/api-client';
import { catalogSchema } from '@/types/lending';
export const catalogService = {
  fetchLoanCatalog(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/loan-catalog', catalogSchema, { signal });
  },
};
