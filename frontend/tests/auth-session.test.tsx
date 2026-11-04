import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { AuthSessionProvider, useAuthSession } from '../src/features/auth/auth-provider';
import { LoginPage } from '../src/features/auth/login-page';
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const profile = {
  id: 'staff-1',
  name: 'Staff User',
  email: 'staff@example.invalid',
  role: 'STAFF',
  status: 'ACTIVE',
  permissions: ['ASSET_VIEW', 'LOAN_CREATE', 'LOAN_VIEW_OWN', 'RETURN_CREATE'],
};
function SessionProbe() {
  const auth = useAuthSession();
  return (
    <>
      <span data-testid="session">{auth.authenticated ? auth.user?.name : 'anonymous'}</span>
      <span data-testid="permission">{String(auth.can('USER_MANAGE'))}</span>
      <button
        onClick={() => {
          void auth.logoutCurrentSession();
        }}
      >
        test logout
      </button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('loads a Google user session, redirects staff to assets and clears private data on logout', async () => {
  let authenticated = true;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input, options) => {
      const path = String(input);
      if (path === '/api/auth/me')
        return Response.json({
          authenticated,
          csrf: 'csrf-token',
          user: authenticated ? profile : null,
        });
      if (path === '/api/auth/logout') {
        expect(new Headers(options?.headers).get('X-IQI-Request')).toBe('csrf-token');
        authenticated = false;
        return Response.json({ authenticated });
      }
      throw new Error(`Unexpected request ${path}`);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['users'], { private: 'previous session data' });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <AuthSessionProvider>
          <LoginPage />
          <SessionProbe />
        </AuthSessionProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('Staff User'));
  expect(screen.getByTestId('permission').textContent).toBe('false');
  expect(navigation.replace).toHaveBeenCalledWith('/loans');
  await userEvent.setup().click(screen.getByRole('button', { name: 'test logout' }));
  await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('anonymous'));
  expect(client.getQueryData(['users'])).toBeUndefined();
});
it('offers Google sign-in for an anonymous session', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ authenticated: false, csrf: 'csrf-token', user: null })),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <AuthSessionProvider>
          <LoginPage />
        </AuthSessionProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  expect(
    (await screen.findByRole('link', { name: 'เข้าสู่ระบบด้วย Google' })).getAttribute('href'),
  ).toBe('/api/auth/google');
  expect(navigation.replace).not.toHaveBeenCalled();
});
