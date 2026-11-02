import type { ApiClient } from '@/lib/api-client';
import { lendingResultSchema, type LoanRequestInput } from '@/types/lending';
export const loansService = {
  submitLoanRequest(api: ApiClient, body: LoanRequestInput) {
    return api.request('/api/loans', lendingResultSchema, { method: 'POST', body });
  },
};
