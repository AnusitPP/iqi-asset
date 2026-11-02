import {
  Home,
  LayoutDashboard,
  ClipboardCheck,
  Package,
  PackageOpen,
  RotateCcw,
  UsersRound,
  History,
  ShieldCheck,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';

export type PortalService = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  planned?: boolean;
  external?: boolean;
};
export type PortalModule = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'green' | 'blue' | 'violet' | 'amber';
  services: readonly PortalService[];
};
export const homeService: PortalService = {
  id: 'home',
  label: 'หน้าหลัก',
  href: '/',
  icon: Home,
  permission: 'PORTAL_HOME_VIEW',
};
export const portalModules: readonly PortalModule[] = [
  {
    id: 'overview',
    title: 'ภาพรวม',
    description: 'ติดตามภาพรวมและสถานะการใช้งาน',
    icon: LayoutDashboard,
    tone: 'green',
    services: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'ADMIN_DASHBOARD_VIEW',
      },
      {
        id: 'inspection',
        label: 'ตรวจเช็คครุภัณฑ์',
        href: '/assets',
        icon: ClipboardCheck,
        permission: 'ASSET_VIEW',
      },
    ],
  },
  {
    id: 'assets',
    title: 'ครุภัณฑ์และวัสดุ',
    description: 'จัดการการยืม ถือครอง เบิก และคืนครุภัณฑ์',
    icon: Package,
    tone: 'blue',
    services: [
      {
        id: 'loans',
        label: 'ยืมครุภัณฑ์',
        href: '/loans',
        icon: PackageOpen,
        permission: 'LOAN_CREATE',
      },
      // {
      //   id: 'asset-holdings',
      //   label: 'ถือครองครุภัณฑ์',
      //   href: '/services/asset-holdings',
      //   icon: PackageCheck,
      //   planned: true,
      // },
      // {
      //   id: 'material-requisition',
      //   label: 'เบิกวัสดุ',
      //   href: '/services/material-requisition',
      //   icon: PackagePlus,
      //   planned: true,
      // },
      {
        id: 'returns',
        label: 'คืนครุภัณฑ์',
        href: '/returns',
        icon: RotateCcw,
        permission: 'RETURN_CREATE',
      },
    ],
  },
  // {
  //   id: 'it-services',
  //   title: 'ซอฟต์แวร์และบริการไอที',
  //   description: 'ขอใช้งานและจัดการซอฟต์แวร์ อุปกรณ์ และบริการด้านไอที',
  //   icon: MonitorCog,
  //   tone: 'violet',
  //   services: [
  //     {
  //       id: 'purchase-request',
  //       label: 'ขอซื้อซอฟต์แวร์ ฮาร์ดแวร์',
  //       href: '/services/purchase-request',
  //       icon: ShoppingBag,
  //       planned: true,
  //     },
  //     {
  //       id: 'software-loan',
  //       label: 'ยืมใช้ซอฟต์แวร์',
  //       href: '/services/software-loan',
  //       icon: AppWindow,
  //       planned: true,
  //     },
  //     {
  //       id: 'teams',
  //       label: 'สร้าง Teams',
  //       href: '/services/teams',
  //       icon: UsersRound,
  //       planned: true,
  //     },
  //     {
  //       id: 'printer',
  //       label: 'ลงทะเบียน Printer',
  //       href: '/services/printer',
  //       icon: Printer,
  //       planned: true,
  //     },
  //     {
  //       id: 'jumbo-guest',
  //       label: 'JumboGuest',
  //       href: '/services/jumbo-guest',
  //       icon: Wifi,
  //       planned: true,
  //     },
  //   ],
  // },
  // {
  //   id: 'other',
  //   title: 'อื่น ๆ',
  //   description: 'บริการและระบบงานอื่นที่เกี่ยวข้อง',
  //   icon: Ellipsis,
  //   tone: 'amber',
  //   services: [
  //     { id: 'websites', label: 'เว็บไซต์', href: '/services/websites', icon: Globe, planned: true },
  //     {
  //       id: 'computer-compensation',
  //       label: 'ชดเชยคอม2',
  //       href: '/services/computer-compensation',
  //       icon: Laptop,
  //       planned: true,
  //     },
  //     { id: 'other', label: 'อื่น ๆ', href: '/services/other', icon: Ellipsis, planned: true },
  //   ],
  // },
];
export const accountModule: PortalModule = {
  id: 'account',
  title: 'บัญชีและการจัดการ',
  description: 'รายการของคุณและการจัดการระบบ',
  icon: ShieldCheck,
  tone: 'green',
  services: [
    {
      id: 'my-requests',
      label: 'รายการของฉัน',
      href: '/my-requests',
      icon: ListChecks,
      permission: 'LOAN_VIEW_OWN',
    },
    { id: 'users', label: 'ผู้ใช้งาน', href: '/users', icon: UsersRound, permission: 'USER_VIEW' },
    { id: 'audit', label: 'Audit Log', href: '/audit', icon: History, permission: 'AUDIT_VIEW' },
  ],
};
export const sidebarModules = [...portalModules, accountModule];
export const allPortalServices = [
  homeService,
  ...sidebarModules.flatMap((module) => module.services),
];
export function findPortalService(path: string) {
  return allPortalServices.find(
    (service) =>
      service.href === path ||
      (service.href !== '/' && !service.external && path.startsWith(service.href + '/')),
  );
}
export function findPortalModule(path: string) {
  return sidebarModules.find((module) =>
    module.services.some((service) => service.href === path || path.startsWith(service.href + '/')),
  );
}
export function isServiceAllowed(service: PortalService, can: (permission: string) => boolean) {
  return can(service.permission ?? 'PORTAL_HOME_VIEW');
}
