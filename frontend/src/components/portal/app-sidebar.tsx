'use client';
import Link from 'next/link';
import { Tooltip, Anchor, Box, UnstyledButton, Badge, Image, Menu } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { myRequestsSchema } from '@/types/account';
import { pendingRequestCounts } from '@/features/my-requests/pending-counts';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { sidebarModules, isServiceAllowed, type PortalService } from '@/config/navigation';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
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
  pendingCount = 0,
}: {
  service: PortalService;
  path: string;
  collapsed: boolean;
  pendingCount?: number;
}) {
  const navigate = usePortalLinkHandler();
  const Icon = service.icon;
  const active =
    path === service.href || (service.href !== '/' && path.startsWith(service.href + '/'));
  const content = (
    <>
      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      <span className="portal-nav-label">{service.label}</span>
      {pendingCount > 0 && (
        <Badge
          color="red"
          variant="filled"
          size="sm"
          radius="xl"
          className="portal-nav-count"
          aria-hidden="true"
        >
          {pendingCount}
        </Badge>
      )}
      {service.planned && <span className="portal-nav-planned" aria-label="อยู่ระหว่างพัฒนา" />}
    </>
  );
  const props = {
    className: `portal-nav-item${active ? ' is-active' : ''}`,
    'aria-label': `${service.label}${pendingCount > 0 ? ` · รอดำเนินการ ${pendingCount} รายการ` : ''}`,
    'aria-current': active ? ('page' as const) : undefined,
  };
  return (
    <Tooltip
      label={`${props['aria-label']}${service.planned ? ' · อยู่ระหว่างพัฒนา' : ''}`}
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
  const { api, can, user, previewRole, setPreviewRole } = useAuthSession();
  const dirty = useHasUnsavedChanges();
  const switchView = (role: 'ADMIN' | 'STAFF' | null) => {
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนมุมมองหรือไม่?')) return;
    setPreviewRole?.(role);
  };
  const profile = user && (
    <>
      <UserAvatar name={user.name} url={user.avatar_url} />
      <Box className="portal-profile-copy">
        <strong>{user.name}</strong>
        <span>{user.role}</span>
      </Box>
    </>
  );
  const canViewApprovals =
    !!user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role) && can('LOAN_VIEW_ALL');
  const approvals = useQuery({
    queryKey: ['approval-requests', user?.id],
    queryFn: ({ signal }) => api.request('/api/approval-requests', myRequestsSchema, { signal }),
    enabled: canViewApprovals,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const pendingCount = canViewApprovals ? pendingRequestCounts(approvals.data?.records).total : 0;
  const navigate = usePortalLinkHandler();
  return (
    <Box className={`portal-sidebar-inner${collapsed ? ' is-collapsed' : ''}`}>
      <Box className="portal-sidebar-brand-row">
        <Anchor
          component={Link}
          href={defaultWorkspacePath()}
          className="portal-brand"
          onClick={navigate}
          aria-label="Asset Checker หน้าหลัก"
        >
          <Image
            src="/icon.png"
            alt=""
            aria-hidden="true"
            className="portal-brand-mark"
            w={40}
            h={40}
            fit="contain"
          />
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
                    pendingCount={service.id === 'approval-requests' ? pendingCount : 0}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box className="portal-sidebar-bottom">
        {profile &&
          (setPreviewRole ? (
            <Menu position="right-end" withinPortal>
              <Menu.Target>
                <UnstyledButton className="portal-sidebar-profile" aria-label="มุมมองตาม Role">
                  {profile}
                  {!collapsed && <ChevronDown size={14} aria-hidden="true" />}
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>มุมมองตาม Role</Menu.Label>
                <Menu.Item disabled={previewRole === 'ADMIN'} onClick={() => switchView('ADMIN')}>
                  ADMIN
                </Menu.Item>
                <Menu.Item disabled={previewRole === 'STAFF'} onClick={() => switchView('STAFF')}>
                  STAFF
                </Menu.Item>
                {previewRole && (
                  <Menu.Item onClick={() => switchView(null)}>กลับสู่ Super Admin</Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Box className="portal-sidebar-profile">{profile}</Box>
          ))}
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
