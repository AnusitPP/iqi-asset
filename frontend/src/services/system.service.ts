import { z } from 'zod';
import type { ApiClient } from '@/lib/api-client';
import { statusSchema } from '@/types/contracts';

export const systemService = {
  trashAssetReportEntry(api: ApiClient, row: number, values: string[]) {
    return api.request('/api/sheets/asset-report/trash', z.object({ ok: z.literal(true) }), {
      method: 'POST',
      body: { row, values },
    });
  },
  addAssetReportEntry(api: ApiClient, body: Record<string, string>) {
    return api.request('/api/sheets/asset-report', z.object({ ok: z.literal(true) }), {
      method: 'POST',
      body,
    });
  },
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
