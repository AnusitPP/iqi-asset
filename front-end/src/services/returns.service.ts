import type { ApiClient } from '@/lib/api-client';
import { lendingResultSchema, type ReturnRequestInput } from '@/types/lending';
export const returnsService = {
  submitReturnRequest(api: ApiClient, body: ReturnRequestInput) {
    return api.request('/api/returns', lendingResultSchema, { method: 'POST', body });
  },
};
