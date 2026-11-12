'use client';
import { Box, Text } from '@mantine/core';
import { isReturnPending } from '@shared/features/lending/status.js';
import type { ReactNode } from 'react';
import { catalogCategory } from '@shared/features/catalog/search.js';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';
import { EquipmentCard } from './equipment-card';
import { LoanTimeBadge } from './loan-time-badge';
import { LoanPeriod } from './loan-period';
import { RequestStatusBadge } from './request-status-badge';
import type { RequestDetailRecord } from './request-details-summary';
import styles from './loan-period.module.css';

export function BorrowedEquipmentCard({
  record,
  id,
  today,
  action,
  overlay,
  children,
  categoryIndicator,
}: {
  record: RequestDetailRecord;
  id: string;
  today: string;
  action: ReactNode;
  overlay?: ReactNode;
  children?: ReactNode;
  categoryIndicator?: ReactNode;
}) {
  const returnPending = isReturnPending(record);
  const days =
    record.kind === 'ยืม' && !record.completed && !returnPending && isIsoCalendarDate(record.due)
      ? calendarDaysBetween(today, record.due)
      : null;
  const timeLabel =
    days === null
      ? ''
      : days < 0
        ? `เกินกำหนด ${-days} วัน`
        : days === 0
          ? 'ครบกำหนดวันนี้'
          : `เหลือ ${days} วัน`;
  return (
    <EquipmentCard
      photo={record.photo}
      name={record.name || record.asset}
      category={catalogCategory(record.name)}
      detail={`เลขคำขอ: ${id}`}
      categoryIndicator={categoryIndicator}
      overlay={overlay}
      action={action}
      badges={
        <>
          {days === null ? <Box /> : <LoanTimeBadge text={timeLabel} overdue={days < 0} />}
          <RequestStatusBadge
            record={record}
            variant="filled"
            c="white"
            size="md"
            radius="xl"
            className={styles.statusBadge}
          />
        </>
      }
      progress={
        returnPending ? (
          <Text size="lg" c="blue" fw={700}>
            รอดำเนินการ
          </Text>
        ) : record.kind === 'ยืม' && !record.completed && record.status === 'กำลังยืม' ? (
          <LoanPeriod start={record.date} due={record.due} today={today} />
        ) : undefined
      }
    >
      {children}
    </EquipmentCard>
  );
}
