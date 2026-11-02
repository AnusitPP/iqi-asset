'use client';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { UnsavedChangesProvider } from '@/hooks/use-unsaved';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthSessionProvider } from '@/features/auth/auth-provider';
const theme = createTheme({
  primaryColor: 'portalGreen',
  primaryShade: 6,
  colors: {
    portalGreen: [
      '#f2faf5',
      '#eaf5ef',
      '#d4ebdd',
      '#b1d9c4',
      '#7cc0a0',
      '#46a47d',
      '#16805d',
      '#116c4e',
      '#0b503b',
      '#0b3d2e',
    ],
  },
  black: '#111827',
  defaultRadius: 'md',
  fontFamily: 'Noto Sans Thai, Tahoma, sans-serif',
});
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    client.setQueryDefaults(['workspace-state'], { gcTime: Infinity });
    return client;
  });
  return (
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <UnsavedChangesProvider>
          <ToastProvider>
            <AuthSessionProvider>{children}</AuthSessionProvider>
          </ToastProvider>
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
