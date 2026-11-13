import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ErrorAlert } from '../src/components/ui/feedback';

afterEach(cleanup);

it('shows errors in a dismissible dialog and refreshes without submitting a form', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const error = new Error('ข้อมูลเปลี่ยนไป กรุณาโหลดใหม่');
  const view = render(
    <MantineProvider>
      <ErrorAlert error={error} onRefresh={refresh} />
    </MantineProvider>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'ทำรายการไม่สำเร็จ' });
  expect(within(dialog).getByText(error.message)).toBeTruthy();
  await userEvent.click(within(dialog).getByRole('button', { name: 'รีเฟรช' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  await userEvent.click(within(dialog).getByRole('button', { name: 'ปิด' }));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  view.rerender(
    <MantineProvider>
      <ErrorAlert error={new Error('โหลดอีกครั้งไม่สำเร็จ')} onRefresh={refresh} />
    </MantineProvider>,
  );
  expect(await screen.findByRole('dialog')).toBeTruthy();
});

it('keeps refresh failures inside the popup', async () => {
  const refresh = vi.fn().mockRejectedValue(new Error('ยังโหลดข้อมูลไม่ได้'));
  render(
    <MantineProvider>
      <ErrorAlert error={new Error('โหลดข้อมูลไม่สำเร็จ')} onRefresh={refresh} />
    </MantineProvider>,
  );
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'รีเฟรช' }));
  expect(await within(dialog).findByText('ยังโหลดข้อมูลไม่ได้')).toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
});
