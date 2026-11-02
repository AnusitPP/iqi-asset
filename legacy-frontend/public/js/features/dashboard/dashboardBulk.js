export async function saveStatusDrafts(
  drafts,
  save,
  { isCurrent = () => true, onProgress = () => {} } = {},
) {
  const entries = [...drafts.entries()];
  const saved = [],
    failed = [];
  for (const [row, draft] of entries) {
    if (!isCurrent()) break;
    onProgress(saved.length + failed.length + 1, entries.length);
    try {
      const result = await save(row, draft);
      saved.push({ row, result });
      if (isCurrent() && drafts.get(row) === draft) drafts.delete(row);
    } catch (error) {
      failed.push({ row, message: error.message });
    }
  }
  return { saved, failed };
}
