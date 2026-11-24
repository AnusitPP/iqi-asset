'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
const UnsavedContext = createContext({
  dirty: false,
  setSourceHasUnsavedChanges: (_id: symbol, _dirty: boolean): void => {
    void _id;
    void _dirty;
  },
});
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Set<symbol>>(new Set());
  const setSourceHasUnsavedChanges = useCallback((id: symbol, dirty: boolean) => {
    setEntries((old) => {
      if (old.has(id) === dirty) return old;
      const next = new Set(old);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  return (
    <UnsavedContext.Provider value={{ dirty: entries.size > 0, setSourceHasUnsavedChanges }}>
      {children}
    </UnsavedContext.Provider>
  );
}
export function useHasUnsavedChanges() {
  return useContext(UnsavedContext).dirty;
}
export function useUnsavedChangesGuard(dirty: boolean) {
  const { setSourceHasUnsavedChanges } = useContext(UnsavedContext);
  const [id] = useState(() => Symbol());
  useEffect(() => {
    setSourceHasUnsavedChanges(id, dirty);
    return () => setSourceHasUnsavedChanges(id, false);
  }, [dirty, id, setSourceHasUnsavedChanges]);
  useEffect(() => {
    if (!dirty) return;
    const preventUnloadWithUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventUnloadWithUnsavedChanges);
    return () => window.removeEventListener('beforeunload', preventUnloadWithUnsavedChanges);
  }, [dirty]);
}
