import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient } from '../src/lib/api-client';
import { preserveUnchangedAssetValues } from '../src/lib/display';
import { preparePhotoForUpload } from '../src/features/photos/photo-utils';
import {
  saveStatusDraftsSequentially,
  type StatusDraft,
} from '../src/features/dashboard/save-drafts';

describe('regressions retained after retiring the Vanilla frontend', () => {
  it('keeps untouched CRLF and bare-CR values when other fields are edited', () => {
    expect(
      preserveUnchangedAssetValues(
        ['Formula result\r\nsecond line', 'old note', 'unchanged\rvalue'],
        ['Formula result\nsecond line', 'old note', 'unchanged\nvalue'],
        ['Formula result\nsecond line', 'new note', 'unchanged\nvalue'],
      ),
    ).toEqual(['Formula result\r\nsecond line', 'new note', 'unchanged\rvalue']);
  });
  it('rejects hosted HEIC above the server upload limit before decoding or sending it', async () => {
    const large = new File([new Uint8Array(5 * 1024 * 1024)], 'photo.heic', { type: 'image/heic' });
    await expect(preparePhotoForUpload(large, 4 * 1024 * 1024)).rejects.toThrow('4 MB');
    const small = new File([new Uint8Array(1024)], 'photo.heic', { type: 'image/heic' });
    expect(await preparePhotoForUpload(small, 4 * 1024 * 1024)).toBe(small);
  });
  it('preserves newer edits while stopping a stale bulk save', async () => {
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'a' }],
      [3, { status: 'ดี', revision: 'b' }],
    ]);
    let current = true;
    const newer = { status: 'ชำรุด', revision: 'new' };
    const result = await saveStatusDraftsSequentially(
      drafts,
      async () => {
        drafts.set(2, newer);
        current = false;
        return {};
      },
      undefined,
      () => current,
    );
    expect(result.saved).toHaveLength(1);
    expect(drafts.get(2)).toBe(newer);
    expect(drafts.has(3)).toBe(true);
  });
  it('handles platform HTML/text, incomplete JSON, 413 and typed JSON success', async () => {
    const invoke = (response: Response) =>
      new ApiClient(undefined, vi.fn<typeof fetch>().mockResolvedValue(response)).request(
        '/api/auth/login',
        z.object({ authenticated: z.boolean() }),
      );
    for (const type of ['text/plain', 'text/html'])
      await expect(
        invoke(
          new Response('A server error has occurred', {
            status: 500,
            headers: { 'Content-Type': type },
          }),
        ),
      ).rejects.toThrow('HTTP 500');
    await expect(
      invoke(new Response('<html>not json</html>', { headers: { 'Content-Type': 'text/html' } })),
    ).rejects.toThrow('ผิดรูปแบบ');
    await expect(
      invoke(new Response('{', { headers: { 'Content-Type': 'application/json' } })),
    ).rejects.toThrow('JSON ไม่สมบูรณ์');
    await expect(
      invoke(Response.json({ error: 'ข้อมูลเปลี่ยนไป' }, { status: 409 })),
    ).rejects.toThrow(/ข้อมูลเปลี่ยนไป.*409/);
    await expect(invoke(new Response('too large', { status: 413 }))).rejects.toThrow('ไฟล์ใหญ่');
    expect(await invoke(Response.json({ authenticated: true }))).toEqual({ authenticated: true });
  });
});
