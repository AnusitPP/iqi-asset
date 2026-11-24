import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorPopup } from '../src/components/core/error-popup';
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '../src/hooks/use-unsaved';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('returns to an unsaved form without reloading or submitting, and reopens for a new error', async () => {
  vi.useFakeTimers();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  function UnsavedForm({ error }: { error: Error }) {
    useUnsavedChangesGuard(true);
    return (
      <form onSubmit={submit}>
        <input aria-label="หมายเหตุ" defaultValue="ข้อมูลร่างที่ยังไม่ได้บันทึก" />
        <ErrorPopup error={error} />
      </form>
    );
  }
  const originalError = new Error('บันทึกไม่สำเร็จ');
  const content = (error: Error) => (
    <MantineProvider>
      <UnsavedChangesProvider>
        <UnsavedForm error={error} />
      </UnsavedChangesProvider>
    </MantineProvider>
  );
  const view = render(content(originalError));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.getByText('มีข้อมูลที่ยังไม่ได้บันทึก กรุณากดรีเฟรชเมื่อพร้อม')).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช' }));
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByLabelText('หมายเหตุ')).toHaveProperty('value', 'ข้อมูลร่างที่ยังไม่ได้บันทึก');
  expect(confirm).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  view.rerender(content(originalError));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(content(new Error('บันทึกครั้งใหม่ไม่สำเร็จ')));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText('กำลังรีเฟรชใน 5 วินาที')).toBeTruthy();
});

it('counts down and refreshes once after five seconds', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <MantineProvider>
      <ErrorPopup error={new Error('โหลดไม่ได้')} onRefresh={refresh} />
    </MantineProvider>,
  );
  expect(screen.getByText('กำลังรีเฟรชใน 5 วินาที')).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(screen.getByText('กำลังรีเฟรชใน 1 วินาที')).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('cancels automatic refresh after a manual refresh or unmount', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <MantineProvider>
      <ErrorPopup error={new Error('โหลดไม่ได้')} onRefresh={refresh} />
    </MantineProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช' }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  view.unmount();
  const second = render(
    <MantineProvider>
      <ErrorPopup error={new Error('โหลดไม่ได้')} onRefresh={refresh} />
    </MantineProvider>,
  );
  second.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('keeps the popup open on Escape and outside clicks and refreshes without submitting a form', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const error = new Error('ข้อมูลเปลี่ยนไป กรุณาโหลดใหม่');
  const view = render(
    <MantineProvider>
      <ErrorPopup error={error} onRefresh={refresh} />
    </MantineProvider>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'ทำรายการไม่สำเร็จ' });
  expect(within(dialog).queryByText('กรุณารอสักครู่')).toBeNull();
  expect(dialog.querySelector('img')?.getAttribute('src')).toBe(
    '/assets/images/delivery-worker.gif',
  );
  expect(within(dialog).getByText(error.message)).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  const overlay = document.querySelector('.mantine-Modal-overlay');
  expect(overlay).not.toBeNull();
  if (overlay) await userEvent.click(overlay);
  expect(screen.getByRole('dialog')).toBeTruthy();
  await userEvent.click(within(dialog).getByRole('button', { name: 'รีเฟรช' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  view.rerender(
    <MantineProvider>
      <ErrorPopup error={new Error('โหลดอีกครั้งไม่สำเร็จ')} onRefresh={refresh} />
    </MantineProvider>,
  );
  expect(await screen.findByRole('dialog')).toBeTruthy();
});

it('keeps refresh failures inside the popup', async () => {
  const refresh = vi.fn().mockRejectedValue(new Error('ยังโหลดข้อมูลไม่ได้'));
  render(
    <MantineProvider>
      <ErrorPopup error={new Error('โหลดข้อมูลไม่สำเร็จ')} onRefresh={refresh} />
    </MantineProvider>,
  );
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'รีเฟรช' }));
  expect(await within(dialog).findByText('ยังโหลดข้อมูลไม่ได้')).toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
});
