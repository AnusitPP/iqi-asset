import { ApiError } from '@/lib/api-client';
export type StatusDraft = { status: string; revision: string };
export async function saveStatusDraftsSequentially<T>(
  drafts: Map<number, StatusDraft>,
  saveSingleStatusDraft: (row: number, draft: StatusDraft) => Promise<T>,
  onProgress: (done: number, total: number) => void = () => {},
  isCurrent: () => boolean = () => true,
) {
  const entries = [...drafts.entries()],
    saved: { row: number; result: T }[] = [],
    failed: { row: number; message: string }[] = [];
  for (const [row, draft] of entries) {
    if (!isCurrent()) break;
    onProgress(saved.length + failed.length + 1, entries.length);
    try {
      const result = await saveSingleStatusDraft(row, draft);
      saved.push({ row, result });
      if (isCurrent() && drafts.get(row) === draft) drafts.delete(row);
    } catch (error) {
      failed.push({ row, message: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' });
      if (error instanceof ApiError && error.status === 401) break;
    }
  }
  return { saved, failed };
}
