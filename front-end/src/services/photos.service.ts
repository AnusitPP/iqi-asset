import type { ApiClient } from '@/lib/api-client';
import { photoResultSchema, uploadConfigSchema } from '@/types/contracts';

export const photosService = {
  fetchUploadLimits(api: ApiClient, signal?: AbortSignal) {
    return api.request('/api/upload-config', uploadConfigSchema, { signal });
  },
  uploadAssetPhoto(api: ApiClient, row: number, binary: Blob, revision: string) {
    return api.request(`/api/dashboard/${row}/photos`, photoResultSchema, {
      method: 'POST',
      binary,
      revision,
    });
  },
  buildPhotoPreviewUrl(row: number, photoId: string) {
    return `/api/dashboard/${row}/photos/${encodeURIComponent(photoId)}`;
  },
};
