import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient, ApiError } from '../src/lib/api-client';
import {
  calculateInspectionAgeInDays,
  formatBangkokDateInBuddhistEra,
  updateInspectionDateInNote,
  preserveUnchangedAssetValues,
} from '../src/lib/display';
import { passwordSchema, inspectionFormSchema, recordSchema } from '../src/types/contracts';
import {
  extractUniqueDrivePhotos,
  validatePhotoUploadSelection,
} from '../src/features/photos/photo-utils';
import {
  saveStatusDraftsSequentially,
  type StatusDraft,
} from '../src/features/dashboard/save-drafts';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

describe('API boundary', () => {
  it('validates unknown payloads and preserves cookie/CSRF/revision/binary', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ revision: 'fresh' }));
    const api = new ApiClient(undefined, transport);
    api.setCsrfToken('token');
    const binary = new Blob(['photo']);
    expect(
      await api.request('/api/dashboard/2/photos', z.object({ revision: z.string() }), {
        method: 'POST',
        binary,
        revision: 'original',
      }),
    ).toEqual({ revision: 'fresh' });
    const options = transport.mock.calls[0]?.[1];
    expect(options?.credentials).toBe('same-origin');
    expect(options?.body).toBe(binary);
    const headers = new Headers(options?.headers);
    expect(headers.get('X-IQI-Request')).toBe('token');
    expect(headers.get('X-Record-Revision')).toBe('original');
    expect(headers.get('Content-Type')).toBe('application/octet-stream');
  });
  it.each([401, 403, 404, 409, 422, 429, 500])(
    'surfaces HTTP %i and backend message',
    async (status) => {
      const unauthorized = vi.fn(),
        api = new ApiClient(
          unauthorized,
          vi
            .fn<typeof fetch>()
            .mockResolvedValue(
              Response.json(
                { error: 'ข้อความจากเซิร์ฟเวอร์' },
                { status, headers: { 'Retry-After': '60' } },
              ),
            ),
        );
      await expect(api.request('/api/search', z.object({}))).rejects.toMatchObject({
        status,
        message: `ข้อความจากเซิร์ฟเวอร์ (HTTP ${status})`,
        retryAfter: '60',
      });
      expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );
  it('does not invalidate an existing session on wrong password', async () => {
    const unauthorized = vi.fn();
    const api = new ApiClient(
      unauthorized,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })),
    );
    await expect(api.request('/api/auth/login', z.object({}))).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).not.toHaveBeenCalled();
  });
  it('rejects non-JSON, corrupt JSON and structurally invalid success', async () => {
    for (const response of [
      new Response('<html>'),
      new Response('{', { headers: { 'Content-Type': 'application/json' } }),
      Response.json({ count: 'bad' }),
    ]) {
      const api = new ApiClient(undefined, vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(
        api.request('/api/search', z.object({ count: z.number() })),
      ).rejects.toBeInstanceOf(ApiError);
    }
  });
  it('forwards abort signals', async () => {
    const controller = new AbortController();
    controller.abort();
    const api = new ApiClient(
      undefined,
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    );
    await expect(
      api.request('/api/search', z.object({}), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
describe('business presentation', () => {
  it('keeps Bangkok timezone, Buddhist era and valid civil dates', () => {
    expect(formatBangkokDateInBuddhistEra(new Date('2026-10-28T18:00:00Z'))).toBe('29/10/2569');
    expect(calculateInspectionAgeInDays('๒๘/๑๐/๒๕๖๙', '29/10/2569')?.days).toBe(1);
    expect(calculateInspectionAgeInDays('31/02/2569')).toBeNull();
    expect(calculateInspectionAgeInDays('2026-10-30', '29/10/2569')?.days).toBe(-1);
  });
  it('preserves note content and untouched CRLF cells', () => {
    expect(updateInspectionDateInNote('ยังอยู่\nวันที่ตรวจสอบ 01/01/2569', '29/10/2569')).toBe(
      'ยังอยู่\nวันที่ตรวจสอบ 29/10/2569',
    );
    expect(
      preserveUnchangedAssetValues(['a\r\nb', 'old'], ['a\nb', 'old'], ['a\nb', 'new']),
    ).toEqual(['a\r\nb', 'new']);
  });
  it('requires password and an explicitly selected inspection result', () => {
    expect(passwordSchema.safeParse({ password: '' }).success).toBe(false);
    expect(inspectionFormSchema.safeParse({ status: '' }).success).toBe(false);
    expect(inspectionFormSchema.safeParse({ status: 'ดี' }).success).toBe(true);
  });
  it('rejects inconsistent sheet row widths before display', () => {
    expect(
      recordSchema.safeParse({
        sheet: 'IQI',
        label: 'IQI',
        row: 2,
        headers: ['a'],
        values: [],
        assetIndex: 0,
        editable: true,
        revision: 'v',
        dropdowns: [],
        dateIndex: null,
        dateMode: 'date',
        today: '',
      }).success,
    ).toBe(false);
  });
  it('deduplicates legacy and current Drive photo slots', () => {
    const url = 'https://drive.google.com/file/d/abc/view';
    expect(
      extractUniqueDrivePhotos(['รูป1', 'รูป2', 'ลิงก์รูปครุภัณฑ์'], [url, 'javascript:bad', url]),
    ).toEqual([{ id: 'abc', url }]);
  });
  it('validates photo capacity, types and HEIC', () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(() => validatePhotoUploadSelection([file, file], 1)).toThrow('เลือกได้อีก');
    expect(() =>
      validatePhotoUploadSelection([new File(['x'], 'a.html', { type: 'text/html' })], 3),
    ).toThrow('JPEG');
    expect(() => validatePhotoUploadSelection([new File(['x'], 'a.heic')], 1)).not.toThrow();
  });
  it('bulk saves include hidden drafts, retain failures, and continue after failures', async () => {
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'a' }],
      [3, { status: 'ชำรุด', revision: 'b' }],
      [4, { status: 'หาไม่เจอ', revision: 'c' }],
    ]);
    const calls: number[] = [];
    const result = await saveStatusDraftsSequentially(drafts, async (row) => {
      calls.push(row);
      if (row === 3) throw new Error('ข้อมูลเปลี่ยนไป');
      return row;
    });
    expect(calls).toEqual([2, 3, 4]);
    expect(result.saved.map((r) => r.row)).toEqual([2, 4]);
    expect([...drafts.keys()]).toEqual([3]);
    expect(result.failed[0]?.message).toBe('ข้อมูลเปลี่ยนไป');
  });
});
describe('transport proxy', () => {
  it('rewrites Origin only for same-origin callers and retains CSRF', () => {
    vi.stubEnv('IQI_BACKEND_ORIGIN', 'http://localhost:3000');
    const response = proxy(
      new NextRequest('http://localhost:3001/api/auth/login', {
        headers: { origin: 'http://localhost:3001', 'X-IQI-Request': 'csrf' },
      }),
    );
    expect(response.headers.get('x-middleware-request-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('x-middleware-request-x-iqi-request')).toBe('csrf');
    vi.unstubAllEnvs();
  });
  it('rejects foreign origins', () => {
    vi.stubEnv('IQI_BACKEND_ORIGIN', 'http://localhost:3000');
    expect(
      proxy(
        new NextRequest('http://localhost:3001/api/auth/login', {
          headers: { origin: 'https://evil.example' },
        }),
      ).status,
    ).toBe(403);
    vi.unstubAllEnvs();
  });
});
