import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { LoginPage } from '../src/features/auth/login-page';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), authenticated: false }));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ authenticated: mocks.authenticated, loading: false, error: null }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
afterEach(cleanup);
function renderWithAppProviders(component: React.ReactNode) {
  return render(<MantineProvider>{component}</MantineProvider>);
}
it('starts Google login through the backend OAuth endpoint', () => {
  mocks.authenticated = false;
  try {
    renderWithAppProviders(<LoginPage />);
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบด้วย Google' }).getAttribute('href')).toBe(
      '/api/auth/google',
    );
    expect(screen.queryByLabelText('รหัสผ่าน')).toBeNull();
  } finally {
    mocks.authenticated = true;
  }
});
