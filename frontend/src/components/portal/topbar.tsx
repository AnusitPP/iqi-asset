'use client';
import Link from 'next/link';
import { Burger } from '@mantine/core';
import { ChevronRight, Home } from 'lucide-react';
import { findPortalModule, findPortalService } from '@/config/navigation';
import { useAuthSession } from '@/features/auth/auth-provider';
import { UserAvatar } from '@/components/ui/user-avatar';
import { usePortalLinkHandler } from './navigation-context';
export function PortalTopbar({
  path,
  menuOpen,
  onMenuToggle,
  connected,
  connecting,
}: {
  path: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  connected: boolean;
  connecting: boolean;
}) {
  const { user } = useAuthSession();
  const navigate = usePortalLinkHandler();
  const current = findPortalService(path);
  const module = findPortalModule(path);
  return (
    <header className="portal-topbar">
      <div className="portal-topbar-start">
        <div className="portal-mobile-toggle">
          <Burger
            size="sm"
            opened={menuOpen}
            onClick={onMenuToggle}
            aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={menuOpen}
            aria-controls="workspace-mobile-menu"
          />
        </div>
        <nav aria-label="เส้นทางหน้า" className="portal-breadcrumbs">
          <Link href="/" onClick={navigate} aria-label="กลับหน้าหลัก">
            <Home size={16} aria-hidden="true" />
          </Link>
          <ChevronRight size={13} aria-hidden="true" />
          {module && (
            <>
              <span className="portal-breadcrumb-group">{module.title}</span>
              <ChevronRight className="portal-breadcrumb-group" size={13} aria-hidden="true" />
            </>
          )}
          <span aria-current="page">{current?.label ?? 'IT Service Portal'}</span>
        </nav>
      </div>
      <div className="portal-topbar-end">
        <span className={`portal-connection${connected ? ' is-online' : ''}`} role="status">
          <i />
          {connecting ? 'กำลังเชื่อมต่อ' : connected ? 'เชื่อมต่อระบบแล้ว' : 'ยังไม่เชื่อมต่อ'}
        </span>
        {user && (
          <div className="portal-topbar-profile">
            <UserAvatar name={user.name} url={user.avatar_url} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
