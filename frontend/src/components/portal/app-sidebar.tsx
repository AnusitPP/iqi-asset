'use client';
import Link from 'next/link';
import { Tooltip, Anchor, Box, UnstyledButton } from '@mantine/core';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  homeService,
  sidebarModules,
  isServiceAllowed,
  type PortalService,
} from '@/config/navigation';
import { useAuthSession } from '@/features/auth/auth-provider';
import { UserAvatar } from '@/components/ui/user-avatar';
import { defaultWorkspacePath } from '@/types/account';
import { usePortalLinkHandler } from './navigation-context';

type SidebarProps = {
  path: string;
  collapsed: boolean;
  mobile?: boolean;
  groups: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
  leaving: boolean;
};
function SidebarItem({
  service,
  path,
  collapsed,
}: {
  service: PortalService;
  path: string;
  collapsed: boolean;
}) {
  const navigate = usePortalLinkHandler();
  const Icon = service.icon;
  const active =
    path === service.href || (service.href !== '/' && path.startsWith(service.href + '/'));
  const content = (
    <>
      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      <span className="portal-nav-label">{service.label}</span>
      {service.planned && <span className="portal-nav-planned" aria-label="อยู่ระหว่างพัฒนา" />}
    </>
  );
  const props = {
    className: `portal-nav-item${active ? ' is-active' : ''}`,
    'aria-label': service.label,
    'aria-current': active ? ('page' as const) : undefined,
  };
  return (
    <Tooltip
      label={`${service.label}${service.planned ? ' · อยู่ระหว่างพัฒนา' : ''}`}
      position="right"
      disabled={!collapsed}
    >
      {service.external ? (
        <Anchor href={service.href} target="_blank" rel="noreferrer" {...props}>
          {content}
        </Anchor>
      ) : (
        <Anchor component={Link} href={service.href} onClick={navigate} {...props}>
          {content}
        </Anchor>
      )}
    </Tooltip>
  );
}
export function AppSidebar({
  path,
  collapsed,
  mobile = false,
  groups,
  onToggleGroup,
  onToggleCollapse,
  onLogout,
  leaving,
}: SidebarProps) {
  const { can, user } = useAuthSession();
  const navigate = usePortalLinkHandler();
  return (
    <Box className={`portal-sidebar-inner${collapsed ? ' is-collapsed' : ''}`}>
      <Box className="portal-sidebar-brand-row">
        <Anchor
          component={Link}
          href={isServiceAllowed(homeService, can) ? '/' : defaultWorkspacePath(user)}
          className="portal-brand"
          onClick={navigate}
          aria-label="Asset Checker หน้าหลัก"
        >
          <span className="portal-brand-mark">i.</span>
          <span className="portal-brand-copy">
            <strong>Asset Checker</strong>
            <small>IT SERVICE PORTAL</small>
          </span>
        </Anchor>
        {!mobile && (
          <Tooltip label={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'} position="right">
            <UnstyledButton
              className="portal-icon-button portal-collapse-toggle"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'ขยายแถบเมนู' : 'ย่อแถบเมนู'}
              aria-expanded={!collapsed}
              aria-controls="portal-desktop-navigation"
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </UnstyledButton>
          </Tooltip>
        )}
      </Box>
      <Box
        component="nav"
        className="portal-navigation"
        aria-label="หน้าข้อมูล"
        id={mobile ? 'portal-mobile-navigation' : 'portal-desktop-navigation'}
      >
        {isServiceAllowed(homeService, can) && (
          <SidebarItem service={homeService} path={path} collapsed={collapsed} />
        )}
        {sidebarModules.map((module) => {
          const services = module.services.filter((service) => isServiceAllowed(service, can));
          if (!services.length) return null;
          const open = groups[module.id] ?? !['it-services', 'other'].includes(module.id);
          const id = `portal-${mobile ? 'mobile' : 'desktop'}-group-${module.id}`;
          return (
            <Box
              component="section"
              className="portal-nav-group"
              key={module.id}
              aria-label={module.title}
            >
              {collapsed ? (
                <Box className="portal-nav-divider" />
              ) : (
                <UnstyledButton
                  className="portal-nav-group-button"
                  onClick={() => onToggleGroup(module.id)}
                  aria-expanded={open}
                  aria-controls={id}
                >
                  <span>{module.title}</span>
                  <ChevronDown size={14} className={open ? 'is-open' : ''} aria-hidden="true" />
                </UnstyledButton>
              )}
              <Box id={id} hidden={!collapsed && !open}>
                {services.map((service) => (
                  <SidebarItem
                    key={service.id}
                    service={service}
                    path={path}
                    collapsed={collapsed}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box className="portal-sidebar-bottom">
        {user && (
          <Box className="portal-sidebar-profile">
            <UserAvatar name={user.name} url={user.avatar_url} />
            <Box className="portal-profile-copy">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </Box>
          </Box>
        )}
        <Tooltip label="ล็อกออก" position="right" disabled={!collapsed}>
          <UnstyledButton
            className="portal-logout"
            onClick={onLogout}
            disabled={leaving}
            aria-label="ล็อกออก"
          >
            <LogOut size={18} aria-hidden="true" />
            <span className="portal-nav-label">{leaving ? 'กำลังออกจากระบบ…' : 'ล็อกออก'}</span>
          </UnstyledButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
