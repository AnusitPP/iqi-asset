'use client';
import { Button, Group, Text } from '@mantine/core';

export function ListPagination({
  page,
  totalPages,
  onChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="xs"
      my="md"
      role="navigation"
      aria-label="เปลี่ยนหน้ารายการ"
    >
      <Button
        type="button"
        variant="default"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ก่อนหน้า
      </Button>
      <Text size="sm" ta="center" aria-live="polite">
        หน้า {page} / {totalPages}
      </Text>
      <Button
        type="button"
        variant="default"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        ถัดไป
      </Button>
    </Group>
  );
}
