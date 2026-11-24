import type { ApiClient } from '@/lib/api-client';
import { uploadConfigSchema } from '@/types/contracts';

export const photosService = {
  fetchUploadLimits(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/upload-config', uploadConfigSchema, { signal });
  },
};
