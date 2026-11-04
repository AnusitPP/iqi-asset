import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import type { ReactNode, AnchorHTMLAttributes } from 'react';
import { permissionsForRole } from '@shared/features/auth/permissions.js';
import { ApiClient } from '../src/lib/api-client';
import {
  userSchema,
  roleSchema,
  userStatusSchema,
  canAccess,
  defaultWorkspacePath,
  type AccountUser,
} from '../src/types/account';
import { UsersPage } from '../src/features/users/users-page';
import { AuditPage } from '../src/features/audit/audit-page';
import { MyRequestsPage } from '../src/features/my-requests/my-requests-page';
import { AuthenticatedWorkspace } from '../src/components/layout/workspace';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
const navigation = vi.hoisted(() => ({ path: '/assets', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.path,
  useRouter: () => navigation,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const makeUser = (id: string, role: AccountUser['role'] = 'STAFF') =>
  userSchema.parse({
    id,
    name: id === 'owner' ? 'System Owner' : 'Staff Example',
    email: `${id}@example.invalid`,
    role,
    status: 'ACTIVE',
    permissions: permissionsForRole(role),
    created_at: '2026-10-01T00:00:00Z',
    last_login_at: '2026-11-01T08:00:00Z',
  });
let currentUser = makeUser('owner', 'SUPER_ADMIN');
let users = [makeUser('staff'), makeUser('owner', 'SUPER_ADMIN')];
const transport = vi.fn<typeof fetch>();
const api = new ApiClient(undefined, transport);
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api,
    user: currentUser,
    can: (permission: string) => canAccess(currentUser, permission),
    authenticated: true,
    loading: false,
    error: null,
    logoutCurrentSession: vi.fn(),
  }),
}));
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  return { ...view, client };
}
beforeEach(() => {
  currentUser = makeUser('owner', 'SUPER_ADMIN');
  users = [makeUser('staff'), makeUser('owner', 'SUPER_ADMIN')];
  navigation.path = '/assets';
  navigation.replace.mockClear();
  transport.mockReset();
  transport.mockImplementation(async (input, options) => {
    const path = String(input);
    const url = new URL(path, 'http://fixture.invalid');
    if (url.pathname === '/api/status')
      return Response.json({
        connected: true,
        csrf: 'test',
        sheets: [],
        reviewUrl: null,
        iqiItUrl: null,
      });
    if (url.pathname === '/api/admin/users') {
      const search = url.searchParams.get('search') || '';
      return Response.json({
        records: users.filter(
          (user) =>
            (!search || `${user.name} ${user.email}`.includes(search)) &&
            (!url.searchParams.get('role') || user.role === url.searchParams.get('role')) &&
            (!url.searchParams.get('status') || user.status === url.searchParams.get('status')),
        ),
      });
    }
    if (url.pathname.startsWith('/api/admin/users/')) {
      const parts = url.pathname.split('/');
      const user = users.find((candidate) => candidate.id === parts[4]);
      if (!user) return Response.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
      if (options?.method === 'PATCH') {
        const body: unknown = JSON.parse(String(options.body));
        if (parts[5] === 'role') user.role = roleSchema.parse((body as { role: unknown }).role);
        if (parts[5] === 'status')
          user.status = userStatusSchema.parse((body as { status: unknown }).status);
      }
      return Response.json({ user });
    }
    if (url.pathname === '/api/audit')
      return Response.json({
        records: [
          {
            id: 'audit-1',
            actor_user_id: 'staff',
            actor_name_snapshot: 'Staff Example',
            actor_email_snapshot: 'staff@example.invalid',
            action: 'LOAN_CREATED',
            entity_type: 'Loan',
            entity_id: 'L-1',
            before_data: '',
            after_data: '{"status":"requested"}',
            created_at: '2026-11-01T08:00:00Z',
          },
        ],
      });
    if (url.pathname === '/api/my-requests')
      return Response.json({
        records: [
          {
            id: 'L-1',
            kind: 'ยืม',
            name: 'Mouse',
            asset: 'A-1',
            date: '2026-11-01',
            status: 'รอดำเนินการ',
          },
        ],
      });
    throw new Error(`Unexpected request ${path}`);
  });
});
afterEach(cleanup);

it('shows mobile user cards and opens account details without a wide table', async () => {
  const originalMatchMedia = vi.mocked(window.matchMedia).getMockImplementation()!;
  const media = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...originalMatchMedia(query),
    matches: query === '(max-width: 47.99em)',
  }));
  const view = mount(<UsersPage />);
  try {
    const user = userEvent.setup();
    await screen.findByText('Staff Example');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('staff@example.invalid')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'จัดการสิทธิ์' })).toHaveLength(1);
    await user.click(screen.getAllByRole('button', { name: 'รายละเอียด' })[0]!);
    expect(await screen.findByRole('dialog', { name: 'ข้อมูลผู้ใช้งาน' })).toBeTruthy();
  } finally {
    view.unmount();
    media.mockImplementation(originalMatchMedia);
  }
});
it('hides administrative menus for STAFF and redirects a forbidden direct route', async () => {
  currentUser = makeUser('staff');
  navigation.path = '/users';
  mount(
    <AuthenticatedWorkspace>
      <div>Private user management</div>
    </AuthenticatedWorkspace>,
  );
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/loans'));
  expect(screen.queryByText('Private user management')).toBeNull();
  expect(screen.queryByRole('link', { name: 'ผู้ใช้งาน' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Audit Log' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  expect(screen.getByRole('link', { name: 'รายการของฉัน' })).toBeTruthy();
});
it('filters users and edits role/status through their existing PATCH endpoints', async () => {
  mount(<UsersPage />);
  const user = userEvent.setup();
  await screen.findByText('Staff Example');
  await user.type(screen.getByLabelText('ค้นหาผู้ใช้งาน'), 'staff@');
  await user.click(screen.getByRole('button', { name: 'ค้นหา' }));
  await waitFor(() => expect(screen.queryByText('System Owner')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'จัดการสิทธิ์' }));
  const dialog = await screen.findByRole('dialog');
  await user.selectOptions(await within(dialog).findByLabelText('Role'), 'ADMIN');
  await user.selectOptions(within(dialog).getByLabelText('สถานะ'), 'DISABLED');
  await user.click(within(dialog).getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(users[0]?.role).toBe('ADMIN');
  expect(users[0]?.status).toBe('DISABLED');
  expect(
    transport.mock.calls.filter(([, options]) => options?.method === 'PATCH').map(([path]) => path),
  ).toEqual(['/api/admin/users/staff/role', '/api/admin/users/staff/status']);
});
it('lets ADMIN view users without offering role or status mutations', async () => {
  currentUser = makeUser('admin', 'ADMIN');
  mount(<UsersPage />);
  await screen.findByText('Staff Example');
  expect(screen.queryByRole('button', { name: 'จัดการสิทธิ์' })).toBeNull();
  const row = screen.getByText('Staff Example').closest('tr');
  if (!row) throw new Error('Missing user row');
  await userEvent.setup().click(within(row).getByRole('button', { name: 'รายละเอียด' }));
  await screen.findByRole('dialog');
  expect(screen.queryByLabelText('Role')).toBeNull();
  expect(transport.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
});
it('keeps the sole SUPER_ADMIN read-only', async () => {
  mount(<UsersPage />);
  await screen.findByText('System Owner');
  const row = screen.getByText('System Owner').closest('tr');
  expect(row).toBeTruthy();
  if (!row) throw new Error('Owner row missing');
  expect(within(row).queryByRole('button', { name: 'จัดการสิทธิ์' })).toBeNull();
  await userEvent.setup().click(within(row).getByRole('button', { name: 'รายละเอียด' }));
  expect(await screen.findByText(/บัญชีหลักของระบบ/)).toBeTruthy();
  expect(screen.queryByLabelText('Role')).toBeNull();
});
it('stops user access changes and cache updates after leaving the session', async () => {
  const defaultTransport = transport.getMockImplementation();
  if (!defaultTransport) throw new Error('Missing fixture transport');
  let finishRole: ((response: Response) => void) | undefined;
  transport.mockImplementation((path, options) => {
    if (options?.method === 'PATCH')
      return new Promise<Response>((resolve) => {
        finishRole = resolve;
      });
    return defaultTransport(path, options);
  });
  const view = mount(<UsersPage />);
  await screen.findByText('Staff Example');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'จัดการสิทธิ์' }));
  const dialog = await screen.findByRole('dialog');
  await user.selectOptions(await within(dialog).findByLabelText('Role'), 'ADMIN');
  await user.selectOptions(within(dialog).getByLabelText('สถานะ'), 'DISABLED');
  await user.click(within(dialog).getByRole('button', { name: 'บันทึกการเปลี่ยนแปลง' }));
  await waitFor(() => expect(finishRole).toBeDefined());
  view.unmount();
  view.client.removeQueries();
  await act(async () => {
    finishRole?.(Response.json({ user: { ...makeUser('staff'), role: 'ADMIN' } }));
  });
  expect(transport.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
  expect(view.client.getQueryData(['user', 'staff'])).toBeUndefined();
});
it('filters audit entries and shows before/after data as text', async () => {
  mount(<AuditPage />);
  const user = userEvent.setup();
  await screen.findByText('L-1');
  await user.click(screen.getByRole('button', { name: 'ดูรายละเอียด' }));
  expect(await screen.findByText(/"status": "requested"/)).toBeTruthy();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ปิด' }));
  await user.type(screen.getByLabelText('ค้นหาประวัติ'), 'missing');
  expect(screen.getByText(/ไม่พบรายการที่ตรงกับตัวกรอง/)).toBeTruthy();
});
it('loads own requests with the current API contract', async () => {
  currentUser = makeUser('staff');
  mount(<MyRequestsPage />);
  expect(await screen.findByText('ยืม · Mouse')).toBeTruthy();
  expect(screen.getByText('รอดำเนินการ')).toBeTruthy();
});
it('derives landing pages and permissions from server-issued grants', () => {
  expect(defaultWorkspacePath(makeUser('staff'))).toBe('/loans');
  expect(defaultWorkspacePath(makeUser('owner', 'SUPER_ADMIN'))).toBe('/dashboard');
  expect(canAccess(makeUser('staff'), 'USER_MANAGE')).toBe(false);
});
it('does not restore revoked capabilities from stale or overbroad cached grants', () => {
  const staleStaff = {
    ...makeUser('staff'),
    permissions: ['ASSET_VIEW', 'LOAN_CREATE', 'LOAN_VIEW_OWN', 'RETURN_CREATE', '*'],
  };
  expect(canAccess(staleStaff, 'ASSET_VIEW')).toBe(false);
  expect(canAccess(staleStaff, 'LOAN_CREATE')).toBe(true);
  const staleAdmin = { ...makeUser('admin', 'ADMIN'), permissions: ['*', 'AUDIT_VIEW'] };
  expect(canAccess(staleAdmin, 'AUDIT_VIEW')).toBe(false);
  expect(canAccess(staleAdmin, 'USER_MANAGE')).toBe(false);
  expect(canAccess(staleAdmin, 'USER_VIEW')).toBe(true);
});
