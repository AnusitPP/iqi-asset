import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { ApiClient } from '../src/lib/api-client';
import { AuthenticatedWorkspace } from '../src/components/layout/workspace';
import { PortalHomePage } from '../src/features/home/home-page';
import { recentServicesKey } from '../src/features/home/recently-used';
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
const auth = { permissions: ['*'] };
const transport = vi.fn<typeof fetch>();
const api = new ApiClient(undefined, transport);
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api,
    authenticated: true,
    user: { name: 'Portal Test User', role: 'SUPER_ADMIN' },
    can: (permission: string) =>
      auth.permissions.includes('*') || auth.permissions.includes(permission),
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
  auth.permissions = ['*'];
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
it('shows module destinations and summary/activity values from existing APIs', async () => {
  render(portal(<PortalHomePage />, createClient()));
  expect(screen.getByRole('heading', { name: 'หน้าหลักระบบงานไอที' })).toBeTruthy();
  const main = within(screen.getByRole('main'));
  expect(
    await within(main.getByRole('article', { name: 'รายการครุภัณฑ์' })).findByText('12'),
  ).toBeTruthy();
  expect(within(main.getByRole('article', { name: 'ตรวจเช็คแล้ว' })).getByText('7')).toBeTruthy();
  expect(within(main.getByRole('article', { name: 'รอการตรวจเช็ค' })).getByText('5')).toBeTruthy();
  expect(await main.findByText('Activity Fixture User')).toBeTruthy();
  const equipment = within(main.getByRole('region', { name: 'ครุภัณฑ์และวัสดุ' }));
  expect(equipment.getByRole('link', { name: 'ยืมครุภัณฑ์' }).getAttribute('href')).toBe('/loans');
  expect(equipment.getByRole('link', { name: /ถือครองครุภัณฑ์/ }).getAttribute('href')).toBe(
    '/services/asset-holdings',
  );
  expect(equipment.getByRole('link', { name: 'คืนครุภัณฑ์' }).getAttribute('href')).toBe(
    '/returns',
  );
  expect(main.getByText('ยังไม่มีประวัติการเปิดบริการ')).toBeTruthy();
});
it('does not request dashboard or audit data for STAFF and labels unavailable summaries', async () => {
  auth.permissions = ['ASSET_VIEW', 'LOAN_CREATE', 'RETURN_CREATE', 'LOAN_VIEW_OWN'];
  render(portal(<PortalHomePage />, createClient()));
  const requests = screen.getByRole('article', { name: 'คำร้องของฉัน' });
  expect(await within(requests).findByText('1')).toBeTruthy();
  expect(
    transport.mock.calls.some(([path]) => path === '/api/dashboard' || path === '/api/audit'),
  ).toBe(false);
  expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  expect(
    within(screen.getByRole('article', { name: 'รายการครุภัณฑ์' })).getByText('—'),
  ).toBeTruthy();
  expect(screen.getByText('ประวัติกิจกรรมแสดงตามสิทธิ์ผู้ใช้งาน')).toBeTruthy();
});
it('persists sidebar collapse and group state across route remounts', async () => {
  const client = createClient();
  const user = userEvent.setup();
  const view = render(portal(<p>Existing page</p>, client));
  const sidebar = within(screen.getByRole('complementary', { name: 'เมนูหลัก' }));
  expect(sidebar.queryByRole('link', { name: 'สร้าง Teams' })).toBeNull();
  await user.click(sidebar.getByRole('button', { name: 'ซอฟต์แวร์และบริการไอที' }));
  expect(sidebar.getByRole('link', { name: 'สร้าง Teams' })).toBeTruthy();
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
  expect(screen.getByRole('link', { name: 'สร้าง Teams' })).toBeTruthy();
});
it('expands the active group on a direct placeholder route', async () => {
  navigation.path = '/services/printer';
  render(portal(<p>Placeholder page</p>, createClient()));
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: 'ลงทะเบียน Printer' }).getAttribute('aria-current'),
    ).toBe('page'),
  );
  expect(
    screen.getByRole('button', { name: 'ซอฟต์แวร์และบริการไอที' }).getAttribute('aria-expanded'),
  ).toBe('true');
});
it('records actual navigation once and renders it when returning home', async () => {
  const client = createClient();
  const view = render(portal(<PortalHomePage />, client));
  expect(screen.getByText('ยังไม่มีประวัติการเปิดบริการ')).toBeTruthy();
  navigation.path = '/assets';
  view.rerender(portal(<p>Inspection content</p>, client));
  await waitFor(() => expect(client.getQueryData(recentServicesKey)).toEqual(['/assets']));
  navigation.path = '/';
  view.rerender(portal(<PortalHomePage />, client));
  const recent = within(screen.getByRole('region', { name: 'บริการที่ใช้ล่าสุด' }));
  expect(recent.getByRole('link', { name: 'ตรวจเช็คครุภัณฑ์' }).getAttribute('href')).toBe(
    '/assets',
  );
  expect(recent.queryByRole('link', { name: 'Dashboard' })).toBeNull();
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
