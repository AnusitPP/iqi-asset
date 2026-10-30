'use client';
import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Burger, Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/features/auth/auth-provider';
import { systemService } from '@/services/system.service';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
const navigationItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/assets', label: 'ค้นหาครุภัณฑ์' },
  { href: '/loans', label: 'ยืมครุภัณฑ์' },
  { href: '/returns', label: 'คืนครุภัณฑ์' },
];
export function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const dirty = useHasUnsavedChanges(),
    auth = useAuthSession(),
    path = usePathname(),
    router = useRouter();
  const [error, setError] = useState<unknown>(null),
    [leaving, setLeaving] = useState(false),
    [menuOpen, setMenuOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const status = useQuery({
    queryKey: ['connection'],
    queryFn: ({ signal }) => systemService.fetchConnectionStatus(auth.api, signal),
    enabled: auth.authenticated,
  });
  useEffect(() => {
    if (!auth.loading && !auth.authenticated && !auth.error) router.replace('/login');
  }, [auth.loading, auth.authenticated, auth.error, router]);
  useEffect(() => {
    if (desktop) setMenuOpen(false);
  }, [desktop]);
  const confirmNavigationWithUnsavedChanges = (event: MouseEvent<HTMLAnchorElement>) => {
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนหน้าหรือไม่?')) {
      event.preventDefault();
      return;
    }
    setMenuOpen(false);
  };
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
  const renderWorkspaceMenu = () => (
    <>
      <Link onClick={confirmNavigationWithUnsavedChanges} className="brand" href="/dashboard">
        <span className="brand-mark">iqi.</span>
        <span className="brand-name">
          Asset Checker<span>ระบบตรวจสอบครุภัณฑ์</span>
        </span>
      </Link>
      <span className={`connection ${status.data && !status.error ? 'online' : 'offline'}`}>
        <span className="status-dot" />
        {status.isFetching
          ? 'กำลังเชื่อมต่อ'
          : status.data && !status.error
            ? 'Google Sheets เชื่อมต่อแล้ว'
            : 'ยังไม่เชื่อมต่อ'}
      </span>
      <nav className="workspace-tabs" aria-label="หน้าข้อมูล">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            onClick={confirmNavigationWithUnsavedChanges}
            className={`workspace-tab ${path === item.href ? 'active' : ''}`}
            href={item.href}
            aria-current={path === item.href ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Button
        variant="subtle"
        loading={leaving}
        onClick={() => {
          void handleLogout();
        }}
      >
        ล็อกออก
      </Button>
    </>
  );
  if (auth.loading) return <LoadingIndicator />;
  if (auth.error)
    return (
      <main className="container">
        <ErrorAlert error={auth.error} />
        <Button onClick={auth.retrySessionLookup}>ลองอีกครั้ง</Button>
      </main>
    );
  if (!auth.authenticated) return <LoadingIndicator />;
  return (
    <div className="workspace-frame">
      <aside className="workspace-sidebar" aria-label="เมนูหลัก">
        {renderWorkspaceMenu()}
      </aside>
      <header className="workspace-mobile-header">
        <Burger
          opened={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
          aria-expanded={menuOpen}
          aria-controls="workspace-mobile-menu"
        />
        <span>IQI Asset Checker</span>
      </header>
      <Drawer
        id="workspace-mobile-menu"
        opened={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="เมนูหลัก"
        size={280}
        transitionProps={{ duration: 180 }}
      >
        {renderWorkspaceMenu()}
      </Drawer>
      <main className="container workspace-content">
        <ErrorAlert error={error} />
        <ErrorAlert error={status.error} />
        {status.error && (
          <Button
            onClick={() => {
              void status.refetch();
            }}
          >
            ลองเชื่อมต่ออีกครั้ง
          </Button>
        )}
        <div className="sheet-links">
          {status.data?.reviewUrl && (
            <a href={status.data.reviewUrl} target="_blank" rel="noreferrer">
              เปิดชีตรอตรวจสอบ ↗
            </a>
          )}
          {status.data?.iqiItUrl && (
            <a href={status.data.iqiItUrl} target="_blank" rel="noreferrer">
              เปิดชีต IT + IQI ↗
            </a>
          )}
        </div>
        {children}
        <footer>
          <span>IQI Asset Checker</span>
          <span>ข้อมูลจาก Google Sheets</span>
        </footer>
      </main>
    </div>
  );
}
