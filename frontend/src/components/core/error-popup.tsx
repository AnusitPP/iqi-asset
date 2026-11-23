'use client';
import { Modal, VisuallyHidden } from '@mantine/core';
import { useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/api-client';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
import { ErrorRecoveryScreen } from '@/features/auth/error-recovery-screen';
export function ErrorPopup({
  error,
  onRefresh,
}: {
  error: unknown;
  onRefresh?: () => unknown | Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedError, setDismissedError] = useState<unknown>(null);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const inFlight = useRef(false);
  const dirty = useHasUnsavedChanges();
  const refresh = async () => {
    if (inFlight.current) return;
    if (!onRefresh) {
      if (dirty) {
        setDismissedError(error);
        setRefreshError(null);
      } else window.location.reload();
      return;
    }
    inFlight.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefresh();
    } catch (caught) {
      setRefreshError(caught);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  };
  return error ? (
    <Modal
      opened={dismissedError !== error}
      onClose={() => {}}
      fullScreen
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={<VisuallyHidden>ทำรายการไม่สำเร็จ</VisuallyHidden>}
      styles={{
        header: { minHeight: 0, padding: 0 },
        body: { padding: 0 },
        content: { background: 'white' },
      }}
    >
      <ErrorRecoveryScreen
        message={getErrorMessage(refreshError ?? error)}
        onRetry={() => void refresh()}
        retrying={refreshing}
      />
    </Modal>
  ) : null;
}
