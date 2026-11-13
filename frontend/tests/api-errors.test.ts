import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient } from '../src/lib/api-client';

describe('friendly API errors', () => {
  it.each([400, 401, 403, 404, 409, 410, 413, 422, 429, 500, 501, 502, 503, 504])(
    'handles JSON and platform errors for status %i without displaying codes',
    async (status) => {
      for (const response of [
        Response.json({ error: `Upstream failure HTTP ${status}` }, { status }),
        new Response('Platform error', { status }),
      ]) {
        const api = new ApiClient(undefined, vi.fn<typeof fetch>().mockResolvedValue(response));
        const error = await api.request('/api/test', z.object({})).catch((error) => error);
        expect(error.status).toBe(status);
        expect(error.message).toMatch(/[ก-๙]/);
        expect(error.message).not.toMatch(/HTTP|Upstream|Platform|\b[45]\d{2}\b/);
      }
    },
  );
  it('preserves actionable validation and uncertain save messages', async () => {
    const message = 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม';
    const api = new ApiClient(
      undefined,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: message }, { status: 502, headers: { 'Retry-After': '60' } }),
        ),
    );
    await expect(api.request('/api/test', z.object({}))).rejects.toMatchObject({
      message,
      status: 502,
      retryAfter: '60',
    });
  });
  it('converts network failures into a connection message', async () => {
    const api = new ApiClient(
      undefined,
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(api.request('/api/test', z.object({}))).rejects.toMatchObject({
      status: 0,
      message: 'เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    });
  });
});
