import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorRecoveryScreen } from '../src/features/auth/error-recovery-screen';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it('links directly to the home page without clearing an existing session or making auth requests', () => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  sessionStorage.setItem('draft', 'old');
  document.cookie = 'iqi_session=fixture; path=/';
  render(<ErrorRecoveryScreen />);
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/assets/images/error-state.png');
  expect(screen.getByRole('link', { name: 'กลับหน้าแรก' }).getAttribute('href')).toBe('/');
  expect(sessionStorage.getItem('draft')).toBe('old');
  expect(document.cookie).toContain('iqi_session=fixture');
  expect(transport).not.toHaveBeenCalled();
});
