'use client';
import { Loader, Group, Stack, Image, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Stack align="center" justify="center" gap="md" py="xl" role="status">
      <Image
        src="/assets/images/empty-state.png"
        alt=""
        aria-hidden="true"
        w={180}
        maw="100%"
        h={180}
        fit="contain"
      />
      <Text size="sm" c="dimmed" ta="center">
        {children}
      </Text>
    </Stack>
  );
}

export function InitialLoadingScreen() {
  return (
    <Stack
      component="main"
      mih="100dvh"
      align="center"
      justify="center"
      gap="md"
      p="lg"
      bg="white"
      role="status"
      aria-live="polite"
    >
      <Image
        src="/assets/images/delivery-worker.gif"
        alt=""
        aria-hidden="true"
        w={200}
        h={200}
        fit="contain"
      />
      <Text size="sm" c="dark">
        กำลังโหลดข้อมูล
      </Text>
    </Stack>
  );
}

export function LoadingIndicator() {
  return (
    <Group justify="center" gap="sm" py="xl" role="status">
      <Loader size="sm" /> กำลังอ่านข้อมูลล่าสุด…
    </Group>
  );
}
