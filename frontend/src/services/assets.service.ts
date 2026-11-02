import type { ApiClient } from '@/lib/api-client';
import { recordSchema, searchSchema, selectionSchema } from '@/types/contracts';

export type AssetTarget = { sheet: string; row: number };
export type SaveAssetInput = { sheet: string; revision: string | null; values: string[] };
export type ReviewSelectionInput = AssetTarget & { revision: string; pending: boolean };

export const assetsService = {
  searchAssets(
    api: ApiClient,
    filters: { query: string; pendingOnly: boolean },
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      q: filters.query,
      pendingOnly: filters.pendingOnly ? '1' : '0',
    });
    return api.request(`/api/search?${params}`, searchSchema, { signal });
  },
  fetchAssetRecord(api: ApiClient, target: AssetTarget, signal?: AbortSignal) {
    return api.request(
      `/api/record?sheet=${encodeURIComponent(target.sheet)}&row=${target.row}`,
      recordSchema,
      { signal },
    );
  },
  updateAssetRecord(api: ApiClient, row: number, body: SaveAssetInput) {
    return api.request(`/api/iqi/${row}`, recordSchema, { method: 'PUT', body });
  },
  updateReviewSelection(api: ApiClient, body: ReviewSelectionInput) {
    return api.request('/api/review-selection', selectionSchema, { method: 'PUT', body });
  },
};
