'use client';
import { Badge } from '@mantine/core';
import { CalendarDays, TriangleAlert } from 'lucide-react';
import styles from './loan-period.module.css';

export function LoanTimeBadge({ text, overdue }: { text: string; overdue: boolean }) {
  return (
    <Badge
      variant="filled"
      c="white"
      color={overdue ? 'red' : 'orange'}
      radius="xl"
      size="md"
      className={styles.timeBadge}
      leftSection={
        overdue ? (
          <TriangleAlert size={14} aria-hidden="true" />
        ) : (
          <CalendarDays size={14} aria-hidden="true" />
        )
      }
      title={text}
    >
      {text}
    </Badge>
  );
}
