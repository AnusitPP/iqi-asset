import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import { ApiClient } from '../src/lib/api-client';
import { AuthenticatedWorkspace } from '../src/components/layout/workspace';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
import { ToastProvider } from '../src/providers/toast-provider';
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));
const sessionState = vi.hoisted(() => ({ loading: false, authenticated: true }));
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
    authenticated: sessionState.authenticated,
    can: () => true,
    loading: sessionState.loading,
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
afterEach(() => {
  cleanup();
  sessionState.loading = false;
  sessionState.authenticated = true;
  navigation.replace.mockClear();
});
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
it.each([true, false])(
  'keeps authenticated home content or redirects to login: %s',
  async (authenticated) => {
    sessionState.authenticated = authenticated;
    renderWorkspace(
      <AuthenticatedWorkspace>
        <p>Home content</p>
      </AuthenticatedWorkspace>,
      new QueryClient(),
    );
    if (authenticated) {
      expect(screen.getByText('Home content')).toBeTruthy();
      expect(navigation.replace).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
      expect(screen.queryByText('Home content')).toBeNull();
    }
  },
);
it('shows only the GIF and loading message before the session is ready', () => {
  sessionState.loading = true;
  const client = new QueryClient();
  const view = renderWorkspace(
    <AuthenticatedWorkspace>
      <p>content</p>
    </AuthenticatedWorkspace>,
    client,
  );
  expect(screen.getByRole('status').textContent).toBe('กำลังโหลดข้อมูล');
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
    '/assets/images/delivery-worker.gif',
  );
  expect(screen.queryByText('content')).toBeNull();
  expect(screen.queryByRole('button', { name: 'เปิดเมนู' })).toBeNull();
  expect(view.container.querySelector('footer')).toBeNull();
});
it('opens the grouped mobile menu and closes it after navigation', async () => {
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
  await user.click(within(drawer).getByRole('link', { name: 'ยืมครุภัณฑ์' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
