import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { AuthSessionProvider, useAuthSession } from '../src/features/auth/auth-provider';
import { LoginPage } from '../src/features/auth/login-page';
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
function SessionProbe() {
  const auth = useAuthSession();
  return (
    <>
      <span data-testid="session">{auth.authenticated ? 'authenticated' : 'anonymous'}</span>
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
it('updates the mounted session and redirects after login without refreshing, then updates logout', async () => {
  let authenticated = false;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/auth/login') {
        authenticated = true;
        return Response.json({ authenticated });
      }
      if (path === '/api/auth/logout') {
        authenticated = false;
        return Response.json({ authenticated });
      }
      if (path === '/api/auth/session') return Response.json({ authenticated, csrf: 'csrf-token' });
      throw new Error(`Unexpected request ${path}`);
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['dashboard'], { private: 'previous session data' });
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
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('รหัสผ่าน'), 'password');
  await user.click(screen.getByRole('button', { name: 'เข้าใช้งาน' }));
  await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('authenticated'));
  expect(navigation.replace).toHaveBeenCalledWith('/dashboard');
  expect(client.getQueryData(['dashboard'])).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'test logout' }));
  await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('anonymous'));
});
