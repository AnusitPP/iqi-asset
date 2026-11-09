'use client';
import { Button, type ButtonProps } from '@mantine/core';

export function RefreshButton({ onClick, ...props }: ButtonProps & { onClick: () => void }) {
  return (
    <Button {...props} onClick={onClick}>
      โหลดรายการล่าสุด
    </Button>
  );
}

export function ResetFiltersButton({ onClick, ...props }: ButtonProps & { onClick: () => void }) {
  return (
    <Button type="button" variant="default" {...props} onClick={onClick}>
      ล้างตัวกรอง
    </Button>
  );
}
