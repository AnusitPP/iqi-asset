'use client';
import { MantineProvider } from '@mantine/core';
import { portalTheme } from '@/config/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { UnsavedChangesProvider } from '@/hooks/use-unsaved';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthSessionProvider } from '@/features/auth/auth-provider';
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
    <MantineProvider theme={portalTheme}>
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
