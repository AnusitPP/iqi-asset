import type { ApiClient } from '@/lib/api-client';
import {
  dashboardAddSchema,
  dashboardSchema,
  dashboardSaveSchema,
  iqiAssetSchema,
} from '@/types/contracts';
import type { z } from 'zod';

export type DashboardData = z.infer<typeof dashboardSchema>;
export type SaveDashboardStatusInput = { status: string; revision: string };
export type SaveDashboardDetailsInput = {
  revision: string;
  team?: string;
  notes?: string;
  fields?: Record<string, string>;
};

export const dashboardService = {
  fetchDashboardData(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/dashboard', dashboardSchema, { signal });
  },
  updateInspectionStatus(api: ApiClient, row: number, body: SaveDashboardStatusInput) {
    return api.request(`/api/dashboard/${row}/status`, dashboardSaveSchema, {
      method: 'PUT',
      body,
    });
  },
  updateTeamAndNotes(api: ApiClient, row: number, body: SaveDashboardDetailsInput) {
    return api.request(`/api/dashboard/${row}/details`, dashboardSaveSchema, {
      method: 'PUT',
      body,
    });
  },
  addFromIqi(api: ApiClient, asset: string, row: number) {
    return api.request('/api/dashboard/from-iqi', dashboardAddSchema, {
      method: 'POST',
      body: { asset, row },
    });
  },
  findIqiAsset(api: ApiClient, asset: string) {
    return api.request(
      `/api/dashboard/from-iqi?asset=${encodeURIComponent(asset)}`,
      iqiAssetSchema,
    );
  },
};
