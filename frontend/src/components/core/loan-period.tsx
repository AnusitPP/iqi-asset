'use client';
import { Box, Group, Progress, Stack, Text } from '@mantine/core';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';

export function LoanPeriod({ start, due, today }: { start: string; due: string; today: string }) {
  if (![start, due, today].every(isIsoCalendarDate)) return null;
  const duration = calendarDaysBetween(start, due);
  if (duration < 0) return null;
  const total = Math.max(1, duration);
  const elapsed = Math.max(0, calendarDaysBetween(start, today) + (duration === 0 ? 1 : 0));
  const remaining = calendarDaysBetween(today, due);
  const overdue = remaining < 0;
  const color = overdue ? 'red' : remaining > 2 ? 'green' : 'yellow';
  const message = overdue
    ? `เกินกำหนด ${-remaining} วัน`
    : remaining === 0
      ? 'กำหนดคืนวันนี้'
      : `เหลือ ${remaining} วัน`;
  const percentage = Math.round((elapsed / total) * 100);
  return (
    <Stack gap={4} mt={4}>
      <Group justify="space-between" gap={4}>
        <Text size="xs" c="dimmed">
          ระยะเวลาการยืม
        </Text>
        <Text size="xs" fw={600}>
          {elapsed} / {total} วัน
        </Text>
      </Group>
      {overdue ? (
        <Box
          role="progressbar"
          aria-label="ระยะเวลาการยืม"
          aria-valuemin={0}
          aria-valuemax={elapsed}
          aria-valuenow={elapsed}
          aria-valuetext={`${percentage}% เกินกำหนด ${-remaining} วัน`}
          style={{
            position: 'relative',
            height: 9,
            display: 'flex',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <Box bg="red.5" style={{ width: `${(total / elapsed) * 100}%` }} />
          <Box bg="red.8" style={{ flex: 1, borderLeft: '2px solid white' }} />
        </Box>
      ) : (
        <Progress
          value={Math.min(100, (elapsed / total) * 100)}
          color={color}
          radius="xl"
          size={9}
          aria-label="ระยะเวลาการยืม"
        />
      )}
      <Text size="lg" c={color} fw={700}>
        {message}
      </Text>
    </Stack>
  );
}
