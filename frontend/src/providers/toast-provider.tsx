'use client';
import { Notification, Affix } from '@mantine/core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
const ToastContext = createContext<{ showToast: (message: string) => void }>({
  showToast: () => {},
});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider
      value={{ showToast: (message) => setToast({ message, id: Date.now() }) }}
    >
      {children}
      {toast && (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={1000}>
          <Notification
            role="status"
            w="min(420px, calc(100vw - 40px))"
            styles={{ description: { overflowWrap: 'anywhere' } }}
            closeButtonProps={{ 'aria-label': 'ปิดการแจ้งเตือน' }}
            onClose={() => setToast(null)}
          >
            {toast.message}
          </Notification>
        </Affix>
      )}
    </ToastContext.Provider>
  );
}
export function useToast() {
  return useContext(ToastContext);
}
