import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import { ApiClient } from '../src/lib/api-client';
import { AuthenticatedWorkspace } from '../src/components/layout/workspace';
import { DashboardPage } from '../src/features/dashboard/dashboard-page';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
import { ToastProvider } from '../src/providers/toast-provider';
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));
const api = new ApiClient(undefined, async (path) => {
  if (path === '/api/status')
    return Response.json({
      connected: true,
      csrf: 'token',
      sheets: ['IQI', 'รายการทั้งหมด', 'all'],
      reviewUrl: null,
      iqiItUrl: null,
    });
  const records = [
    {
      row: 2,
      revision: 'it',
      updatedAt: '',
      asset: 'IT-001',
      name: 'Mouse',
      serial: 'SN-IT',
      inspection: 'ดี',
      comparison: 'ตรงกัน',
      owner: 'ผู้ถือครอง',
      team: 'IT',
      notes: '',
      editableNotes: '',
      values: ['IT-001', 'Mouse', 'SN-IT', 'IT'],
    },
    {
      row: 3,
      revision: 'ga',
      updatedAt: '',
      asset: 'GA-001',
      name: 'Keyboard',
      serial: 'SN-GA',
      inspection: 'ชำรุด',
      comparison: 'ตรงกัน',
      owner: 'ผู้ถือครอง',
      team: 'GA',
      notes: '',
      editableNotes: '',
      values: ['GA-001', 'Keyboard', 'SN-GA', 'GA'],
    },
  ];
  return Response.json({
    headers: ['asset', 'name', 'serial', 'ทีม'],
    teams: ['GA', 'IT'],
    records,
    total: 2,
    completed: 2,
    percent: 100,
    inspection: { ดี: 1, ชำรุด: 1 },
    comparison: { ตรงกัน: 2 },
    loadedAt: '2026-10-30T00:00:00Z',
  });
});
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api,
    authenticated: true,
    loading: false,
    error: null,
    logoutCurrentSession: navigation.logout,
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => navigation,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
afterEach(cleanup);
function renderWorkspace(children: ReactNode, client: QueryClient) {
  return render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>
          <ToastProvider>{children}</ToastProvider>
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}
it('opens the mobile menu with four routes and closes it after navigation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWorkspace(
    <AuthenticatedWorkspace>
      <p>content</p>
    </AuthenticatedWorkspace>,
    client,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เปิดเมนู' }));
  const drawer = screen.getByRole('dialog', { name: 'เมนูหลัก' });
  expect(within(drawer).getByRole('link', { name: 'ยืมครุภัณฑ์' }).getAttribute('href')).toBe(
    '/loans',
  );
  expect(within(drawer).getByRole('link', { name: 'คืนครุภัณฑ์' }).getAttribute('href')).toBe(
    '/returns',
  );
  await user.click(within(drawer).getByRole('link', { name: 'ค้นหาครุภัณฑ์' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('filters by team, retains filters across remount, and resets all filters together', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = renderWorkspace(<DashboardPage />, client);
  const user = userEvent.setup();
  await screen.findByText('IT-001');
  await user.selectOptions(screen.getByLabelText('กรองตามทีม'), 'IT');
  expect(screen.queryByText('GA-001')).toBeNull();
  expect(screen.getByText('IT-001')).toBeTruthy();
  await user.click(screen.getByText('ตัวกรองสถานะและการเทียบข้อมูล'));
  await user.click(screen.getByRole('button', { name: /^ดี\s*1/ }));
  await user.type(screen.getByLabelText('ค้นหารายการ Dashboard'), 'SN-IT');
  page.unmount();
  renderWorkspace(<DashboardPage />, client);
  await waitFor(() => expect(screen.getByLabelText('กรองตามทีม')).toHaveProperty('value', 'IT'));
  expect(screen.getByLabelText('ค้นหารายการ Dashboard')).toHaveProperty('value', 'SN-IT');
  expect(screen.getByRole('button', { name: /^ดี\s*1/ }).getAttribute('aria-pressed')).toBe('true');
  await user.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
  expect(screen.getByLabelText('กรองตามทีม')).toHaveProperty('value', '');
  expect(screen.getByText('GA-001')).toBeTruthy();
});
