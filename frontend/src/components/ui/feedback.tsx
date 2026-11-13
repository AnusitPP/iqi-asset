'use client';
import { Loader, Group } from '@mantine/core';

export function LoadingIndicator() {
  return (
    <Group justify="center" gap="sm" py="xl" role="status">
      <Loader size="sm" /> กำลังอ่านข้อมูลล่าสุด…
    </Group>
  );
}
