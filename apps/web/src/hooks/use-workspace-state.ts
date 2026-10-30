'use client';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// Session-scoped UI state survives route changes; auth cleanup removes it on logout.
export function useWorkspaceState<T>(
  name: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const client = useQueryClient();
  const [value, setValue] = useState<T>(
    () => client.getQueryData<T>(['workspace-state', name]) ?? initialValue,
  );
  useEffect(() => {
    client.setQueryData(['workspace-state', name], value);
  }, [client, name, value]);
  return [value, setValue];
}
