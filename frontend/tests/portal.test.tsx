import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { permissionsForRole } from '@shared/features/auth/permissions.js';
import { canAccess, userSchema, type AccountRole } from '../src/types/account';
import { ApiClient } from '../src/lib/api-client';
import { AuthenticatedWorkspace } from '../src/components/layout/workspace';
import { AuditPage } from '../src/features/audit/audit-page';
import { PortalHomePage } from '../src/features/home/home-page';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
import { allPortalServices, findPortalService, findPortalModule } from '../src/config/navigation';
const navigation = vi.hoisted(() => ({ path: '/', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.path,
  useRouter: () => navigation,
}));
vi.mock('next/link', () => ({
  default: ({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
const auth: { role: AccountRole; permissions: string[] } = {
  role: 'SUPER_ADMIN',
  permissions: ['*'],
};
function currentUser() {
  return userSchema.parse({
    id: 'fixture',
    name: 'Portal Test User',
    email: 'fixture@example.invalid',
    role: auth.role,
    status: 'ACTIVE',
    permissions: auth.permissions,
  });
}
const transport = vi.fn<typeof fetch>();
const api = new ApiClient(undefined, transport);
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api,
    authenticated: true,
    user: currentUser(),
    can: (permission: string) => canAccess(currentUser(), permission),
    loading: false,
    error: null,
    logoutCurrentSession: vi.fn(),
  }),
}));
const dashboard = {
  headers: [],
  teams: [],
  records: [],
  total: 12,
  completed: 7,
  percent: 58.33,
  inspection: {},
  comparison: {},
  loadedAt: '2026-11-02T00:00:00.000Z',
};
beforeEach(() => {
  navigation.path = '/';
  navigation.replace.mockClear();
  auth.role = 'SUPER_ADMIN';
  auth.permissions = permissionsForRole(auth.role);
  transport.mockReset();
  transport.mockImplementation(async (input) => {
    if (input === '/api/status')
      return Response.json({
        connected: true,
        csrf: 'test',
        sheets: [],
        reviewUrl: null,
        iqiItUrl: null,
      });
    if (input === '/api/dashboard') return Response.json(dashboard);
    if (input === '/api/my-requests')
      return Response.json({
        records: [
          {
            id: 'L1',
            kind: 'ยืม',
            asset: 'A1',
            name: 'Mouse',
            date: '2026-11-02',
            status: 'รอดำเนินการ',
          },
        ],
      });
    if (input === '/api/audit')
      return Response.json({
        records: [
          {
            id: 'event-1',
            actor_user_id: 'u1',
            actor_name_snapshot: 'Activity Fixture User',
            actor_email_snapshot: 'fixture@example.invalid',
            action: 'LOAN_CREATED',
            entity_type: 'Loan',
            entity_id: 'L1',
            before_data: '',
            after_data: '',
            created_at: '2026-11-02T00:00:00.000Z',
          },
        ],
      });
    throw new Error(`Unexpected endpoint ${input}`);
  });
});
afterEach(cleanup);
function portal(children: ReactNode, client: QueryClient) {
  return (
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>
          <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
it('shows current service destinations and summary values from existing APIs', async () => {
  render(portal(<PortalHomePage />, createClient()));
  expect(screen.getByRole('heading', { name: 'หน้าหลักระบบงานไอที' })).toBeTruthy();
  const main = within(screen.getByRole('main'));
  expect(
    await within(main.getByRole('article', { name: 'รายการครุภัณฑ์' })).findByText('12'),
  ).toBeTruthy();
  expect(within(main.getByRole('article', { name: 'ตรวจเช็คแล้ว' })).getByText('7')).toBeTruthy();
  expect(within(main.getByRole('article', { name: 'รอการตรวจเช็ค' })).getByText('5')).toBeTruthy();
  const equipment = within(main.getByRole('region', { name: 'ครุภัณฑ์และวัสดุ' }));
  expect(equipment.getByRole('link', { name: 'ยืมครุภัณฑ์' }).getAttribute('href')).toBe('/loans');
  expect(equipment.getByRole('link', { name: 'คืนครุภัณฑ์' }).getAttribute('href')).toBe(
    '/returns',
  );
});
it('shows STAFF only borrowing, returning and own requests and blocks Home', async () => {
  auth.role = 'STAFF';
  auth.permissions = permissionsForRole(auth.role);
  render(portal(<PortalHomePage />, createClient()));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/loans'));
  const nav = within(screen.getByRole('navigation', { name: 'หน้าข้อมูล' }));
  expect(nav.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/loans',
    '/returns',
    '/my-requests',
  ]);
  expect(screen.queryByRole('heading', { name: 'หน้าหลักระบบงานไอที' })).toBeNull();
  expect(transport).not.toHaveBeenCalled();
});
it('shows ADMIN operational menus, Home, user viewing and mail but excludes Audit', async () => {
  auth.role = 'ADMIN';
  auth.permissions = permissionsForRole(auth.role);
  navigation.path = '/dashboard';
  render(portal(<p>Dashboard content</p>, createClient()));
  const nav = within(screen.getByRole('navigation', { name: 'หน้าข้อมูล' }));
  for (const name of [
    'Dashboard',
    'ตรวจเช็คครุภัณฑ์',
    'ยืมครุภัณฑ์',
    'คืนครุภัณฑ์',
    'รายการของฉัน',
    'หน้าหลัก',
    'ผู้ใช้งาน',
    'ส่งอีเมล',
    'คำขออนุมัติ',
    'ไฟล์ Google Sheets',
  ])
    expect(nav.getByRole('link', { name })).toBeTruthy();
  expect(nav.queryByRole('link', { name: 'Audit Log' })).toBeNull();
  await waitFor(() =>
    expect(transport.mock.calls.some(([path]) => path === '/api/status')).toBe(true),
  );
  expect(navigation.replace).not.toHaveBeenCalled();
});
it.each(['/assets', '/dashboard', '/users', '/audit', '/sheets', '/mail', '/approval-requests'])(
  'blocks a direct %s URL for STAFF',
  async (path) => {
    auth.role = 'STAFF';
    auth.permissions = permissionsForRole(auth.role);
    navigation.path = path;
    render(portal(<p>Restricted content</p>, createClient()));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/loans'));
    expect(screen.queryByText('Restricted content')).toBeNull();
    expect(transport).not.toHaveBeenCalled();
  },
);
it('keeps every current menu visible for SUPER_ADMIN', () => {
  render(portal(<p>content</p>, createClient()));
  const nav = within(screen.getByRole('navigation', { name: 'หน้าข้อมูล' }));
  expect(nav.getByRole('link', { name: 'Audit Log' })).toBeTruthy();
  expect(nav.getAllByRole('link')).toHaveLength(allPortalServices.length);
});
it('allows STAFF to open own requests directly', () => {
  auth.role = 'STAFF';
  auth.permissions = permissionsForRole(auth.role);
  navigation.path = '/my-requests';
  render(portal(<p>Own requests content</p>, createClient()));
  expect(screen.getByText('Own requests content')).toBeTruthy();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it('allows SUPER_ADMIN to open Audit directly', async () => {
  auth.role = 'SUPER_ADMIN';
  auth.permissions = permissionsForRole(auth.role);
  navigation.path = '/audit';
  render(portal(<AuditPage />, createClient()));
  expect(screen.getByRole('heading', { name: 'Audit Log' })).toBeTruthy();
  await screen.findByText('Activity Fixture User');
  expect(transport.mock.calls.some(([path]) => path === '/api/audit')).toBe(true);
  expect(navigation.replace).not.toHaveBeenCalled();
});
it('blocks ADMIN from Audit without requesting audit data', async () => {
  auth.role = 'ADMIN';
  auth.permissions = permissionsForRole(auth.role);
  navigation.path = '/audit';
  render(portal(<AuditPage />, createClient()));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/dashboard'));
  expect(screen.queryByRole('heading', { name: 'Audit Log' })).toBeNull();
  expect(transport.mock.calls.some(([path]) => path === '/api/audit')).toBe(false);
});
it.each(['ADMIN', 'SUPER_ADMIN'] as const)('allows %s to open mail directly', (role) => {
  auth.role = role;
  auth.permissions = permissionsForRole(role);
  navigation.path = '/mail';
  render(portal(<p>Mail content</p>, createClient()));
  expect(screen.getByText('Mail content')).toBeTruthy();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it('persists sidebar collapse and group state across route remounts', async () => {
  const client = createClient();
  const user = userEvent.setup();
  const view = render(portal(<p>Existing page</p>, client));
  const sidebar = within(screen.getByRole('complementary', { name: 'เมนูหลัก' }));
  await user.click(sidebar.getByRole('button', { name: 'บัญชีและการจัดการ' }));
  expect(sidebar.queryByRole('link', { name: 'Audit Log' })).toBeNull();
  await user.click(sidebar.getByRole('button', { name: 'ย่อแถบเมนู' }));
  expect(view.container.querySelector('.portal-shell.is-collapsed')).toBeTruthy();
  view.unmount();
  navigation.path = '/loans';
  const next = render(portal(<p>Loan page</p>, client));
  expect(next.container.querySelector('.portal-shell.is-collapsed')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'ยืมครุภัณฑ์' }).getAttribute('aria-current')).toBe(
    'page',
  );
  await user.click(screen.getByRole('button', { name: 'ขยายแถบเมนู' }));
  expect(screen.queryByRole('link', { name: 'Audit Log' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'บัญชีและการจัดการ' }));
  expect(screen.getByRole('link', { name: 'Audit Log' })).toBeTruthy();
});
it('expands the active group on a direct account route', async () => {
  navigation.path = '/my-requests';
  const client = createClient();
  client.setQueryData(['workspace-state', 'portal-sidebar-groups'], { account: false });
  render(portal(<p>Account content</p>, client));
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'รายการของฉัน' }).getAttribute('aria-current')).toBe(
      'page',
    ),
  );
  expect(
    screen.getByRole('button', { name: 'บัญชีและการจัดการ' }).getAttribute('aria-expanded'),
  ).toBe('true');
});
it('shows failed summary data as unavailable rather than a fake zero', async () => {
  const original = transport.getMockImplementation();
  if (!original) throw new Error('Missing fixture transport');
  transport.mockImplementation((input, options) =>
    input === '/api/dashboard'
      ? Promise.resolve(Response.json({ error: 'fixture read failure' }, { status: 503 }))
      : original(input, options),
  );
  render(portal(<PortalHomePage />, createClient()));
  const card = within(screen.getByRole('article', { name: 'รายการครุภัณฑ์' }));
  expect(await card.findByText('ยังไม่สามารถอ่านข้อมูลได้')).toBeTruthy();
  expect(card.queryByText('0')).toBeNull();
  expect(screen.getByRole('button', { name: 'ลองโหลดข้อมูลสรุปอีกครั้ง' })).toBeTruthy();
});
it('has unique configured destinations and resolves existing inspection routes', () => {
  expect(new Set(allPortalServices.map((service) => service.href)).size).toBe(
    allPortalServices.length,
  );
  expect(findPortalService('/assets')?.id).toBe('inspection');
  expect(findPortalModule('/assets')?.id).toBe('overview');
  expect(findPortalService('/not-a-service')).toBeUndefined();
});
