import type { ApiClient } from '@/lib/api-client';
import { inspectionSchema } from '@/types/contracts';
import type { AssetTarget } from './assets.service';

export type InspectionTarget = AssetTarget & { revision: string };
export type SaveInspectionInput = InspectionTarget & { status: string };

export const inspectionsService = {
  fetchReviewInspection(api: ApiClient, target: InspectionTarget, signal?: AbortSignal) {
    const params = new URLSearchParams({
      sheet: target.sheet,
      row: String(target.row),
      revision: target.revision,
    });
    return api.request(`/api/review-inspection?${params}`, inspectionSchema, { signal });
  },
  updateReviewInspection(api: ApiClient, body: SaveInspectionInput) {
    return api.request('/api/review-inspection', inspectionSchema, { method: 'PUT', body });
  },
};
