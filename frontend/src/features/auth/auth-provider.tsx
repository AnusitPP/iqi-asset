'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api-client';
import { authService } from '@/services/auth.service';
import { canAccess, type AccountUser } from '@/types/account';

type AuthContextValue = {
  api: ApiClient;
  authenticated: boolean;
  loading: boolean;
  error: Error | null;
  user: AccountUser | null;
  can: (permission: string) => boolean;
  logoutCurrentSession: () => Promise<void>;
  retrySessionLookup: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [api] = useState(
    () =>
      new ApiClient(async () => {
        await client.cancelQueries();
        client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
        client.setQueryData(['session'], { authenticated: false, csrf: '' });
      }),
  );
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      const result = await authService.fetchAuthSession(api, signal);
      api.setCsrfToken(result.csrf);
      return result;
    },
    staleTime: Infinity,
  });
  const logoutCurrentSession = async () => {
    await authService.logoutCurrentSession(api);
    await client.cancelQueries();
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    client.setQueryData(['session'], { authenticated: false, csrf: '' });
  };
  return (
    <AuthContext.Provider
      value={{
        api,
        authenticated: session.data?.authenticated === true,
        loading: session.isPending,
        error: session.error,
        user: session.data?.user ?? null,
        can: (permission) => canAccess(session.data?.user, permission),
        logoutCurrentSession,
        retrySessionLookup: () => {
          void session.refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthSessionProvider is required');
  return value;
}
