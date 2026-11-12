import type { ApiClient } from '@/lib/api-client';
import { catalogSchema } from '@/types/lending';
import type { CatalogRecord } from '@/types/lending';
import { z } from 'zod';
export const catalogService = {
  remove(api: ApiClient, record: CatalogRecord) {
    return api.request(
      `/api/loan-catalog/${record.row}`,
      z.object({
        deleted: z.literal(true),
        photosTrashed: z.number(),
        photosKept: z.number(),
        photosPending: z.number(),
      }),
      { method: 'DELETE', body: record },
    );
  },
  fetchLoanCatalog(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/loan-catalog', catalogSchema, { signal });
  },
  fetchReturnCatalog(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/return-catalog', catalogSchema, { signal });
  },
};
