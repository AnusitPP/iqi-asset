'use client';
import { Box, Group, SimpleGrid, Text } from '@mantine/core';
import { Barcode, Tag, CalendarDays, UserRound } from 'lucide-react';
import { CatalogPhoto } from './catalog-photo';
import { RequestStatusBadge } from './request-status-badge';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';
import styles from './request-details.module.css';
import { isReturnPending } from '@shared/features/lending/status.js';

export type RequestDetailRecord = {
  name: string;
  asset: string;
  serial: string;
  photo?: string;
  kind: string;
  date: string;
  due: string;
  status: string;
  completed?: boolean;
  borrower?: string;
  borrowerNickname?: string;
  team?: string;
  purpose?: string;
  notes?: string;
};
export function RequestDetailsSummary({
  record: details,
  today,
  showCountdown = true,
}: {
  record: RequestDetailRecord;
  today: string;
  showCountdown?: boolean;
}) {
  const displayDate = (value: string) =>
    isIsoCalendarDate(value)
      ? new Date(value + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Bangkok',
        })
      : value || '—';
  const days =
    details.kind === 'ยืม' &&
    !details.completed &&
    !isReturnPending(details) &&
    isIsoCalendarDate(details.due)
      ? calendarDaysBetween(today, details.due)
      : null;
  const countdown = () =>
    days === null
      ? null
      : {
          text:
            days < 0
              ? `เกินกำหนด ${-days} วัน`
              : days === 0
                ? 'ครบกำหนดวันนี้'
                : `เหลือ ${days} วัน`,
          color: days < 0 ? 'red' : days <= 2 ? 'yellow' : 'portalGreen',
        };
  return (
    <>
      {' '}
      <Box className={styles.photo}>
        <CatalogPhoto key={details.photo} url={details.photo} name={details.name} height={160} />
      </Box>
      <Text fw={700} size="lg">
        {details.name || details.asset}
      </Text>
      <RequestStatusBadge record={details} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} className={styles.metadata}>
        <Group wrap="nowrap">
          <Barcode className={styles.fieldIcon} aria-hidden="true" />
          <Text size="sm" c="dimmed">
            เลขครุภัณฑ์:
          </Text>
          <Text size="sm">{details.asset}</Text>
        </Group>
        <Group wrap="nowrap">
          <Tag className={styles.fieldIcon} aria-hidden="true" />
          <Text size="sm" c="dimmed">
            S/N:
          </Text>
          <Text size="sm">{details.serial || '—'}</Text>
        </Group>
        <Group wrap="nowrap">
          <CalendarDays className={styles.fieldIcon} aria-hidden="true" />
          <Text size="sm" c="dimmed">
            วันที่{details.kind}:
          </Text>
          <Text size="sm">{displayDate(details.date)}</Text>
        </Group>
        <Group wrap="nowrap">
          <CalendarDays className={styles.fieldIcon} aria-hidden="true" />
          <Text size="sm" c="dimmed">
            กำหนดคืน:
          </Text>
          <Text size="sm">{displayDate(details.due)}</Text>
        </Group>
      </SimpleGrid>
      {showCountdown && countdown() && (
        <Text c={countdown()!.color} fw={600}>
          {countdown()!.text}
        </Text>
      )}
      <Box className={styles.borrowing}>
        <Group gap="sm" className={styles.sectionHeading}>
          <UserRound size={23} aria-hidden="true" />
          <Text fw={700}>ข้อมูลการ{details.kind}</Text>
        </Group>
        <Box component="dl" className={styles.description}>
          <dt>ผู้ยืม:</dt>
          <dd>
            {details.borrower || '—'}
            {details.borrowerNickname && ` (${details.borrowerNickname})`}
          </dd>
          <dt>ทีม:</dt>
          <dd>{details.team || '—'}</dd>
          <dt>เหตุผล:</dt>
          <dd>{details.purpose || '—'}</dd>
          <dt>หมายเหตุ:</dt>
          <dd>{details.notes || '—'}</dd>
        </Box>
      </Box>
    </>
  );
}
