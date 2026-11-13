'use client';
import { Button, Loader, Group, Modal, Text } from '@mantine/core';
import { useState } from 'react';
import { getErrorMessage } from '@/lib/api-client';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
export function ErrorAlert({
  error,
  onRefresh,
}: {
  error: unknown;
  onRefresh?: () => unknown | Promise<unknown>;
}) {
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const dirty = useHasUnsavedChanges();
  const close = () => {
    setDismissed(error);
    setRefreshError(null);
  };
  return error ? (
    <Modal
      opened={dismissed !== error}
      onClose={close}
      title="ทำรายการไม่สำเร็จ"
      centered
      closeButtonProps={{ 'aria-label': 'ปิดข้อความแจ้งเตือน' }}
    >
      <Text role="alert">{getErrorMessage(refreshError ?? error)}</Text>
      <Group justify="flex-end" mt="lg">
        <Button type="button" variant="default" onClick={close}>
          ปิด
        </Button>
        <Button
          type="button"
          loading={refreshing}
          onClick={async () => {
            if (!onRefresh) {
              if (
                dirty &&
                !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการรีเฟรชหน้าเว็บหรือไม่?')
              )
                return;
              window.location.reload();
              return;
            }
            setRefreshing(true);
            setRefreshError(null);
            try {
              await onRefresh();
            } catch (caught) {
              setRefreshError(caught);
            } finally {
              setRefreshing(false);
            }
          }}
        >
          รีเฟรช
        </Button>
      </Group>
    </Modal>
  ) : null;
}
export function LoadingIndicator() {
  return (
    <Group justify="center" gap="sm" py="xl" role="status">
      <Loader size="sm" /> กำลังอ่านข้อมูลล่าสุด…
    </Group>
  );
}
