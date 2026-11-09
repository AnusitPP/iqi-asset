'use client';
import { Button } from '@mantine/core';
import { LayoutGrid, List } from 'lucide-react';

export function ViewToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: 'grid' | 'list') => void;
}) {
  return (
    <Button.Group aria-label="มุมมอง">
      <Button
        leftSection={<LayoutGrid size={16} aria-hidden="true" />}
        variant={value === 'grid' ? 'filled' : 'default'}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}
      >
        การ์ด
      </Button>
      <Button
        leftSection={<List size={16} aria-hidden="true" />}
        variant={value === 'list' ? 'filled' : 'default'}
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
      >
        รายการ
      </Button>
    </Button.Group>
  );
}
