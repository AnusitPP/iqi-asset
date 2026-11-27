'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api-client';
import { authService } from '@/services/auth.service';
import { permissionsForRole } from '@shared/features/auth/permissions.js';
import { canAccess, type AccountUser } from '@/types/account';

type PreviewRole = 'ADMIN' | 'STAFF';
type AuthContextValue = {
  previewRole: PreviewRole | null;
  setPreviewRole?: (role: PreviewRole | null) => void;
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
  const [previewRole, setPreviewRole] = useState<PreviewRole | null>(null);
  const [api] = useState(
    () =>
      new ApiClient(async () => {
        setPreviewRole(null);
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
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const realUser = session.data?.user ?? null;
  const canPreview = realUser?.role === 'SUPER_ADMIN';
  const activePreview = canPreview ? previewRole : null;
  const csrf = session.data?.csrf;
  const preview = useMemo(() => {
    if (!activePreview) return null;
    const api = new ApiClient(
      () => void client.invalidateQueries({ queryKey: ['session'] }),
      undefined,
      activePreview,
    );
    api.setCsrfToken(csrf ?? '');
    return { api, queries: new QueryClient({ defaultOptions: client.getDefaultOptions() }) };
  }, [activePreview, client, csrf]);
  const user =
    realUser && activePreview
      ? { ...realUser, role: activePreview, permissions: permissionsForRole(activePreview) }
      : realUser;
  const logoutCurrentSession = async () => {
    await authService.logoutCurrentSession(api);
    setPreviewRole(null);
    await client.cancelQueries();
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    client.setQueryData(['session'], { authenticated: false, csrf: '' });
  };
  return (
    <AuthContext.Provider
      value={{
        api: preview?.api ?? api,
        previewRole: activePreview,
        setPreviewRole: canPreview ? setPreviewRole : undefined,
        authenticated: session.data?.authenticated === true,
        loading: session.isPending,
        error: session.error,
        user,
        can: (permission) => canAccess(user, permission),
        logoutCurrentSession,
        retrySessionLookup: () => {
          void session.refetch();
        },
      }}
    >
      {preview ? (
        <QueryClientProvider key={activePreview} client={preview.queries}>
          {children}
        </QueryClientProvider>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthSessionProvider is required');
  return value;
}
