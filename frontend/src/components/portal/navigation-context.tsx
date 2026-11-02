'use client';
import { createContext, useContext, type ReactNode, type MouseEvent } from 'react';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
const NavigationContext = createContext(() => {});
export function PortalNavigationProvider({
  onNavigate,
  children,
}: {
  onNavigate: () => void;
  children: ReactNode;
}) {
  return <NavigationContext.Provider value={onNavigate}>{children}</NavigationContext.Provider>;
}
export function usePortalLinkHandler() {
  const closeMenu = useContext(NavigationContext);
  const dirty = useHasUnsavedChanges();
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนหน้าหรือไม่?')) {
      event.preventDefault();
      return;
    }
    closeMenu();
  };
}
