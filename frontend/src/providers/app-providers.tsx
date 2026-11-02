'use client';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { UnsavedChangesProvider } from '@/hooks/use-unsaved';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthSessionProvider } from '@/features/auth/auth-provider';
const theme = createTheme({
  primaryColor: 'teal',
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
