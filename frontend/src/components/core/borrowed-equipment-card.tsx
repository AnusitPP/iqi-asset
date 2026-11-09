'use client';
import { Box } from '@mantine/core';
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
  const days =
    record.kind === 'ยืม' && !record.completed && isIsoCalendarDate(record.due)
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
            size="md"
            radius="xl"
            className={styles.statusBadge}
          />
        </>
      }
      progress={
        record.kind === 'ยืม' &&
        !record.completed &&
        ['กำลังยืม', 'รอดำเนินการคืน'].includes(record.status) ? (
          <LoanPeriod start={record.date} due={record.due} today={today} />
        ) : undefined
      }
    >
      {children}
    </EquipmentCard>
  );
}
