'use client';
import { Alert, Loader, Group } from '@mantine/core';
import { getErrorMessage } from '@/lib/api-client';
export function ErrorAlert({ error }: { error: unknown }) {
  return error ? (
    <Alert color="red" role="alert">
      {getErrorMessage(error)}
    </Alert>
  ) : null;
}
export function LoadingIndicator() {
  return (
    <Group justify="center" gap="sm" py="xl" role="status">
      <Loader size="sm" /> กำลังอ่านข้อมูลล่าสุด…
    </Group>
  );
}
