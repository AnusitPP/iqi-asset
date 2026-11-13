'use client';
import { Button, Group, Modal, Text, Image, VisuallyHidden } from '@mantine/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/api-client';
import { useHasUnsavedChanges } from '@/hooks/use-unsaved';
import styles from './error-popup.module.css';
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
  const [seconds, setSeconds] = useState<number | null>(5);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlight = useRef(false);
  const dirty = useHasUnsavedChanges();
  const opened = Boolean(error) && dismissedError !== error;
  const stopCountdown = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    setSeconds(null);
  };
  const refresh = async (automatic = false) => {
    if (inFlight.current) return;
    stopCountdown();
    if (!onRefresh) {
      if (dirty) {
        if (automatic) {
          setRefreshError(new Error('มีข้อมูลที่ยังไม่ได้บันทึก กรุณากดรีเฟรชเมื่อพร้อม'));
          return;
        }
        setDismissedError(error);
        setRefreshError(null);
        return;
      }
      window.location.reload();
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
  const autoRefresh = useEffectEvent(() => {
    void refresh(true);
  });
  useEffect(() => {
    if (!opened) return;
    setRefreshError(null);
    setSeconds(5);
    const deadline = Date.now() + 5000;
    timer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) autoRefresh();
    }, 1000);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
      timer.current = null;
    };
  }, [opened]);
  return error ? (
    <Modal
      opened={opened}
      onClose={() => {}}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={<VisuallyHidden>ทำรายการไม่สำเร็จ</VisuallyHidden>}
      centered
      size={424}
      radius={20}
      withCloseButton={false}
      classNames={{ content: styles.content, header: styles.header, body: styles.body }}
      overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
    >
      <Image
        src="/assets/images/delivery-worker.gif"
        alt=""
        aria-hidden="true"
        w={200}
        h={200}
        fit="contain"
        mx="auto"
      />
      <Text role="alert" ta="center" fw={700} mt="sm" className={styles.message}>
        {getErrorMessage(refreshError ?? error)}
      </Text>
      <Group justify="center" mt="lg">
        <Button
          type="button"
          radius="xl"
          className={styles.refresh}
          loading={refreshing}
          onClick={() => void refresh()}
        >
          รีเฟรช
        </Button>
      </Group>
      {seconds !== null && (
        <Text ta="center" c="dimmed" size="sm" mt="sm">
          กำลังรีเฟรชใน {seconds} วินาที
        </Text>
      )}
    </Modal>
  ) : null;
}
