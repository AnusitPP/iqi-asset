'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, Burger, Container, Drawer, Group, Anchor, Alert, Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
import { useWorkspaceState } from '@/hooks/use-workspace-state';
import { InitialLoadingScreen } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import { defaultWorkspacePath } from '@/types/account';
import { findPortalService, findPortalModule, isServiceAllowed } from '@/config/navigation';
import { AppSidebar } from '@/components/portal/app-sidebar';

import { PortalNavigationProvider } from '@/components/portal/navigation-context';

export function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const dirty = useHasUnsavedChanges();
  const auth = useAuthSession();
  const path = usePathname() ?? '/';
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [leaving, setLeaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useWorkspaceState('portal-sidebar-collapsed', false);
  const [groups, setGroups] = useWorkspaceState<Record<string, boolean>>(
    'portal-sidebar-groups',
    {},
  );
  const desktop = useMediaQuery('(min-width: 1024px)');
  const currentPage = findPortalService(path);
  const activeModule = findPortalModule(path);
  const allowed = !currentPage || isServiceAllowed(currentPage, auth.can);
  useEffect(() => {
    if (!auth.loading && !auth.authenticated && !auth.error) router.replace('/login');
  }, [auth.loading, auth.authenticated, auth.error, router]);
  useEffect(() => {
    if (auth.authenticated && !allowed) router.replace(defaultWorkspacePath());
  }, [auth.authenticated, auth.user, allowed, router]);
  useEffect(() => {
    if (desktop) setMenuOpen(false);
  }, [desktop]);

  const activeGroup = activeModule?.id;
  useEffect(() => {
    if (activeGroup)
      setGroups((previous) =>
        previous[activeGroup] === true ? previous : { ...previous, [activeGroup]: true },
      );
  }, [activeGroup, setGroups]);
  const toggleGroup = (id: string) =>
    setGroups((previous) => ({
      ...previous,
      [id]: !(previous[id] ?? !['it-services', 'other'].includes(id)),
    }));
  const handleLogout = async () => {
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการล็อกออกหรือไม่?')) return;
    setLeaving(true);
    try {
      await auth.logoutCurrentSession();
      setMenuOpen(false);
      router.replace('/login');
    } catch (caught) {
      setError(caught);
    } finally {
      setLeaving(false);
    }
  };
  if (auth.loading || (!auth.authenticated && !auth.error) || (auth.authenticated && !allowed))
    return <InitialLoadingScreen />;
  if (auth.error)
    return (
      <Container component="main" size="sm" py="xl">
        <ErrorPopup error={auth.error} onRefresh={auth.retrySessionLookup} />
      </Container>
    );
  const sidebarProps = {
    path,
    groups,
    onToggleGroup: toggleGroup,
    onToggleCollapse: () => setCollapsed((value) => !value),
    onLogout: () => {
      void handleLogout();
    },
    leaving,
  };
  return (
    <PortalNavigationProvider onNavigate={() => setMenuOpen(false)}>
      <AppShell
        navbar={{ width: collapsed ? 72 : 254, breakpoint: 1024, collapsed: { mobile: true } }}
        padding={0}
        className={`portal-shell${collapsed ? ' is-collapsed' : ''}`}
      >
        <Anchor className="portal-skip-link" href="#portal-main">
          ข้ามไปยังเนื้อหา
        </Anchor>
        <AppShell.Navbar component="aside" aria-label="เมนูหลัก">
          <AppSidebar {...sidebarProps} collapsed={collapsed} />
        </AppShell.Navbar>
        <AppShell.Main>
          <Container className="portal-main" id="portal-main" tabIndex={-1}>
            <Group
              hiddenFrom="sidebar"
              mb="md"
              py="xs"
              bg="var(--portal-bg)"
              style={{ position: 'sticky', top: 0, zIndex: 10 }}
            >
              <Burger
                opened={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
                aria-expanded={menuOpen}
                aria-controls="workspace-mobile-menu"
                size="sm"
              />
            </Group>
            {auth.previewRole && (
              <Alert mb="md" color="blue" role="status">
                <Group justify="space-between">
                  <span>มุมมอง {auth.previewRole} · ดูข้อมูลได้อย่างเดียว</span>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      if (
                        !dirty ||
                        window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนมุมมองหรือไม่?')
                      )
                        auth.setPreviewRole?.(null);
                    }}
                  >
                    กลับสู่ Super Admin
                  </Button>
                </Group>
              </Alert>
            )}
            <ErrorPopup error={error} />
            {children}
          </Container>
        </AppShell.Main>
        <Drawer
          id="workspace-mobile-menu"
          opened={menuOpen}
          onClose={() => setMenuOpen(false)}
          title="เมนูหลัก"
          closeButtonProps={{ 'aria-label': 'ปิดเมนู' }}
          size={288}
          transitionProps={{ duration: 180 }}
          classNames={{ body: 'portal-drawer-body' }}
        >
          <AppSidebar {...sidebarProps} mobile collapsed={false} />
        </Drawer>
      </AppShell>
    </PortalNavigationProvider>
  );
}
