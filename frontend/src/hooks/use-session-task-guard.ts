'use client';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function useSessionTaskGuard() {
  const mounted = useRef(true),
    client = useQueryClient();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return () =>
    mounted.current &&
    client.getQueryData<{ authenticated: boolean }>(['session'])?.authenticated !== false;
}
