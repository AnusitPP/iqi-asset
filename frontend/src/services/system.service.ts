import { z } from 'zod';
import type { ApiClient } from '@/lib/api-client';
import { statusSchema } from '@/types/contracts';

export const systemService = {
  fetchAssetReport(api: ApiClient, signal?: AbortSignal) {
    return api.request(
      '/api/sheets/asset-report',
      z.object({ rows: z.array(z.array(z.string())) }),
      { signal },
    );
  },
  exportAssetReport(api: ApiClient, format: 'csv' | 'xlsx') {
    return api.request(
      `/api/sheets/asset-report/export?format=${format}`,
      z.object({ filename: z.literal(`รายงานครุภัณฑ์ ปี 70.${format}`), content: z.string() }),
    );
  },
  fetchConnectionStatus(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/status', statusSchema, { signal });
  },
};
