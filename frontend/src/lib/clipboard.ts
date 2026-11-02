// Clipboard fallback for LAN HTTP, where navigator.clipboard is unavailable.
// This temporary selection surface is not React application state or rendered UI.
export async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* Try LAN fallback. */
    }
  }
  const previous = document.activeElement,
    selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
    : [];
  const input = document.createElement('textarea');
  input.value = value;
  input.readOnly = true;
  input.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
  // Native modal focus traps require the copy surface to be inside the active modal.
  const modal = previous instanceof HTMLElement ? previous.closest('[role="dialog"]') : null;
  (modal ?? document.body).append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    if (!document.execCommand('copy')) throw new Error('คัดลอกไม่สำเร็จ');
  } finally {
    input.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}
