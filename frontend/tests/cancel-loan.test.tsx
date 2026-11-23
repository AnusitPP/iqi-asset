import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyRequestsPage } from '../src/features/my-requests/my-requests-page';
import { myRequestsSchema } from '../src/types/account';
import { ToastProvider } from '../src/providers/toast-provider';

const request = vi.hoisted(() => vi.fn());
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    user: { id: 'staff-1', role: 'STAFF' },
    can: () => true,
    api: { request },
  }),
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});
function mount(status = 'รอดำเนินการ', kind = 'ยืม', fail = false) {
  let current = status;
  request.mockImplementation(async (_path, _schema, options) => {
    if (options?.method === 'POST') {
      if (fail) throw new Error('รายการถูกอนุมัติแล้ว กรุณาโหลดรายการใหม่');
      current = 'ยกเลิก';
      return { id: 'L-1' };
    }
    return myRequestsSchema.parse({
      records: [{ id: 'L-1', kind, status: current, name: 'Laptop', asset: 'A1' }],
    });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MyRequestsPage />
        </ToastProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  return client;
}
it('requires confirmation and refreshes the request after cancellation', async () => {
  const client = mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'ดูรายละเอียด' }));
  await user.click(screen.getByRole('button', { name: 'ยกเลิกคำขอยืม' }));
  let dialog = within(screen.getByRole('dialog', { name: 'ยืนยันการยกเลิกคำขอยืม' }));
  expect(request.mock.calls.filter((call) => call[2]?.method === 'POST')).toHaveLength(0);
  await user.click(dialog.getByRole('button', { name: 'กลับ' }));
  await user.click(screen.getByRole('button', { name: 'ยกเลิกคำขอยืม' }));
  dialog = within(screen.getByRole('dialog', { name: 'ยืนยันการยกเลิกคำขอยืม' }));
  await user.click(dialog.getByRole('button', { name: 'ยืนยันยกเลิกคำขอ' }));
  await screen.findByText('ยกเลิกคำขอยืม L-1 แล้ว');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(request.mock.calls.filter((call) => call[2]?.method === 'POST')).toHaveLength(1);
  expect(request.mock.calls.find((call) => call[2]?.method === 'POST')?.[0]).toBe(
    '/api/my-requests/L-1/cancel',
  );
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['approval-requests'] }));
  for (const key of ['my-requests', 'loan-catalog', 'return-catalog'])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
});
it.each(['กำลังยืม', 'ยกเลิก', 'ไม่อนุมัติ'])('hides cancellation for %s loans', async (status) => {
  mount(status);
  if (status !== 'กำลังยืม') {
    await screen.findByText('ไม่พบรายการที่ตรงกับตัวกรอง');
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'แสดงรายการที่เสร็จสิ้น' }));
  }
  await userEvent.setup().click(await screen.findByRole('button', { name: 'ดูรายละเอียด' }));
  expect(screen.queryByRole('button', { name: 'ยกเลิกคำขอยืม' })).toBeNull();
});
it('hides cancellation for return requests', async () => {
  mount('รอดำเนินการ', 'คืน');
  await userEvent.setup().click(await screen.findByRole('button', { name: 'ดูรายละเอียด' }));
  expect(screen.queryByRole('button', { name: 'ยกเลิกคำขอยืม' })).toBeNull();
});
it('keeps the confirmation open when the server rejects cancellation', async () => {
  mount('รอดำเนินการ', 'ยืม', true);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'ดูรายละเอียด' }));
  await user.click(screen.getByRole('button', { name: 'ยกเลิกคำขอยืม' }));
  await user.click(screen.getByRole('button', { name: 'ยืนยันยกเลิกคำขอ' }));
  await screen.findByText('รายการถูกอนุมัติแล้ว กรุณาโหลดรายการใหม่');
  expect(screen.getByRole('dialog', { name: 'ยืนยันการยกเลิกคำขอยืม' })).toBeTruthy();
  expect(screen.queryByText('ยกเลิกคำขอยืม L-1 แล้ว')).toBeNull();
});
