import type { ReactNode } from 'react';
import { AuthenticatedWorkspace } from '@/components/layout/workspace';
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>;
}
