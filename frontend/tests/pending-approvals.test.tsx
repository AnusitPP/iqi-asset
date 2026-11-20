import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyRequestsPage } from '../src/features/my-requests/my-requests-page';
import { AppSidebar } from '../src/components/portal/app-sidebar';
import { myRequestsSchema } from '../src/types/account';
import { pendingRequestCounts } from '../src/features/my-requests/pending-counts';

const session = vi.hoisted(() => ({
  user: { id: 'admin-1', role: 'ADMIN', name: 'Admin', email: 'admin@example.invalid' },
  request: vi.fn(),
}));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    user: session.user,
    can: () => true,
    api: { request: session.request },
  }),
}));
afterEach(() => {
  cleanup();
  session.user.role = 'ADMIN';
  session.request.mockReset();
});
const data = myRequestsSchema.parse({
  records: [
    { id: 'L-1', kind: 'ยืม', status: 'รอดำเนินการ' },
    { id: 'L-2', kind: 'ยืม', status: 'กำลังยืม' },
    { id: 'L-3', kind: 'ยืม', status: 'ไม่อนุมัติ' },
    { id: 'L-4', kind: 'ยืม', status: 'รอดำเนินการคืน' },
    { id: 'L-5', kind: 'ยืม', status: 'รอดำเนินการ', completed: true },
    { id: 'R-1', kind: 'คืน', status: 'รอดำเนินการ' },
    { id: 'R-2', kind: 'คืน', status: 'รอรับคืน' },
    { id: 'R-3', kind: 'คืน', status: 'เสร็จสิ้น' },
  ],
});
function mount({ role = 'ADMIN', collapsed = false, page = true } = {}) {
  session.user.role = role;
  session.request.mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <AppSidebar
          path="/approval-requests"
          collapsed={collapsed}
          groups={{}}
          onToggleGroup={() => {}}
          onToggleCollapse={() => {}}
          onLogout={() => {}}
          leaving={false}
        />
        {page && <MyRequestsPage approvals />}
      </QueryClientProvider>
    </MantineProvider>,
  );
  return client;
}

it('counts only pending loans and returns, including legacy return statuses', () => {
  expect(pendingRequestCounts(data.records)).toEqual({ loan: 1, returning: 2, total: 3 });
  expect(pendingRequestCounts()).toEqual({ loan: 0, returning: 0, total: 0 });
});
it('uses shared pending counts for tabs and sidebar, unaffected by the selected tab', async () => {
  const client = mount();
  await screen.findByRole('tab', { name: 'ยืม (1)' });
  expect(screen.getByRole('tab', { name: 'คืน (2)' })).toBeTruthy();
  const link = screen.getByRole('link', { name: 'คำขออนุมัติ · รอดำเนินการ 3 รายการ' });
  expect(within(link).getByText('3')).toBeTruthy();
  expect(session.request).toHaveBeenCalledTimes(1);
  await userEvent.setup().click(screen.getByRole('tab', { name: 'คืน (2)' }));
  expect(screen.getByRole('tab', { name: 'ยืม (1)' })).toBeTruthy();
  await act(async () => {
    client.setQueryData(['approval-requests', 'admin-1'], { records: [] });
  });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'ยืม' })).toBeTruthy());
  expect(screen.getByRole('tab', { name: 'คืน' })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'คำขออนุมัติ' }).querySelector('.portal-nav-count'),
  ).toBeNull();
});
it('keeps the pending badge available in the collapsed menu', async () => {
  mount({ collapsed: true, page: false });
  const link = await screen.findByRole('link', { name: 'คำขออนุมัติ · รอดำเนินการ 3 รายการ' });
  expect(within(link).getByText('3')).toBeTruthy();
});
it('does not fetch approval data for staff', () => {
  mount({ role: 'STAFF', page: false });
  expect(session.request).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/รอดำเนินการ/)).toBeNull();
});
