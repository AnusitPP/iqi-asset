import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient } from '../src/lib/api-client';
import { preserveUnchangedAssetValues } from '../src/lib/display';
import {
  saveStatusDraftsSequentially,
  type StatusDraft,
} from '../src/features/dashboard/save-drafts';

describe('frontend data and transport regressions', () => {
  it('keeps untouched CRLF and bare-CR values when other fields are edited', () => {
    expect(
      preserveUnchangedAssetValues(
        ['Formula result\r\nsecond line', 'old note', 'unchanged\rvalue'],
        ['Formula result\nsecond line', 'old note', 'unchanged\nvalue'],
        ['Formula result\nsecond line', 'new note', 'unchanged\nvalue'],
      ),
    ).toEqual(['Formula result\r\nsecond line', 'new note', 'unchanged\rvalue']);
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
        '/api/auth/session',
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
      ).rejects.toThrow('ระบบขัดข้องชั่วคราว');
    await expect(
      invoke(new Response('<html>not json</html>', { headers: { 'Content-Type': 'text/html' } })),
    ).rejects.toThrow('โหลดข้อมูลไม่สำเร็จ');
    await expect(
      invoke(new Response('{', { headers: { 'Content-Type': 'application/json' } })),
    ).rejects.toThrow('โหลดข้อมูลไม่สำเร็จ');
    await expect(
      invoke(Response.json({ error: 'ข้อมูลเปลี่ยนไป' }, { status: 409 })),
    ).rejects.toThrow('ข้อมูลเปลี่ยนไป');
    await expect(invoke(new Response('too large', { status: 413 }))).rejects.toThrow('ไฟล์ใหญ่');
    expect(await invoke(Response.json({ authenticated: true }))).toEqual({ authenticated: true });
  });
});
