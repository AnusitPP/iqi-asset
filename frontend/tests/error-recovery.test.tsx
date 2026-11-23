import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorRecoveryScreen } from '../src/features/auth/error-recovery-screen';
import { authService } from '../src/services/auth.service';
import { useUnsavedChangesGuard } from '../src/hooks/use-unsaved';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('shows the supplied image and only resets when the user presses the button', async () => {
  const reset = vi
    .spyOn(authService, 'resetCurrentSession')
    .mockRejectedValue(new Error('offline'));
  render(<ErrorRecoveryScreen />);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/assets/images/error-state.png');
  expect(reset).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'กลับหน้าแรก' }));
  await screen.findByText('ยังเริ่มต้นใหม่ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดอีกครั้ง');
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'กลับหน้าแรก' })).not.toHaveProperty('disabled', true);
});

it('obtains fresh CSRF without reading the broken session and posts the reset', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ csrf: 'fresh' }))
    .mockResolvedValueOnce(Response.json({ authenticated: false }));
  vi.stubGlobal('fetch', transport);
  await authService.resetCurrentSession();
  expect(transport.mock.calls.map(([path]) => path)).toEqual([
    '/api/auth/recovery',
    '/api/auth/reset',
  ]);
  const options = transport.mock.calls[1]![1]!;
  expect(options.method).toBe('POST');
  expect(options.credentials).toBe('same-origin');
  expect(new Headers(options.headers).get('X-IQI-Request')).toBe('fresh');
});

it('prevents duplicate resets while a reset is pending', async () => {
  const reset = vi
    .spyOn(authService, 'resetCurrentSession')
    .mockImplementation(() => new Promise(() => {}));
  render(<ErrorRecoveryScreen />);
  const user = userEvent.setup();
  await user.dblClick(screen.getByRole('button', { name: 'กลับหน้าแรก' }));
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'กำลังเริ่มต้นใหม่…' })).toHaveProperty(
    'disabled',
    true,
  );
});

it('clears browser session data and allows navigation away from a draft after a successful reset', async () => {
  vi.spyOn(authService, 'resetCurrentSession').mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sessionStorage.setItem('draft', 'old');
  function DraftError() {
    useUnsavedChangesGuard(true);
    return <ErrorRecoveryScreen />;
  }
  render(<DraftError />);
  const before = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'กลับหน้าแรก' }));
  await waitFor(() => expect(sessionStorage.getItem('draft')).toBeNull());
  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
