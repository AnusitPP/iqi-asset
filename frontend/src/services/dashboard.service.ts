import type { ApiClient } from '@/lib/api-client';
import { dashboardSchema, dashboardSaveSchema } from '@/types/contracts';
import type { z } from 'zod';

export type DashboardData = z.infer<typeof dashboardSchema>;
export type SaveDashboardStatusInput = { status: string; revision: string };
export type SaveDashboardDetailsInput = { revision: string; team?: string; notes?: string };

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
};
