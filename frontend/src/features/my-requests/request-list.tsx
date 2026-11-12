'use client';
import { Box, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { CatalogPhoto } from '@/components/core/catalog-photo';
import { BorrowedEquipmentCard } from '@/components/core/borrowed-equipment-card';
import { RequestStatusBadge } from '@/components/core/request-status-badge';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import type { myRequestsSchema } from '@/types/account';
import type { z } from 'zod';

type RequestRecord = z.infer<typeof myRequestsSchema>['records'][number];
type Countdown = { text: string; color: string } | null;

export function RequestList({
  approvals,
  view,
  pending,
  error,
  updateError,
  records,
  today,
  readKey,
  readStateKey,
  readIds,
  displayDate,
  countdown,
  pickupLabel,
  onOpenDetails,
}: {
  approvals: boolean;
  view: string;
  pending: boolean;
  error: unknown;
  updateError: unknown;
  records: RequestRecord[];
  today: string;
  readKey: string;
  readStateKey: string;
  readIds: string[];
  displayDate: (value: string) => string;
  countdown: (entry: RequestRecord) => Countdown;
  pickupLabel: (entry: RequestRecord) => string;
  onOpenDetails: (entry: RequestRecord) => void;
}) {
  return (
    <>
      <ErrorAlert error={error} />
      <ErrorAlert error={updateError} />
      {pending ? (
        <LoadingIndicator />
      ) : (
        <Stack>
          <Text role="status">
            {records.length
              ? `พบ ${records.length} รายการ`
              : approvals
                ? 'ยังไม่มีรายการของคุณ'
                : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
          </Text>
          <SimpleGrid
            cols={approvals || view === 'list' ? 1 : { base: 1, xs: 2, sm: 3, lg: 4, xl: 6 }}
            spacing="sm"
          >
            {records.map((entry) => {
              const unread =
                readStateKey === readKey && !readIds.includes(`${entry.kind}:${entry.id}`);
              if (!approvals && view === 'grid')
                return (
                  <BorrowedEquipmentCard
                    key={`${entry.kind}-${entry.id}`}
                    record={entry}
                    id={entry.id}
                    today={today}
                    action={
                      <Button fullWidth size="sm" onClick={() => onOpenDetails(entry)}>
                        ดูรายละเอียด
                      </Button>
                    }
                    categoryIndicator={
                      unread && (
                        <Box
                          component="span"
                          role="img"
                          aria-label="ยังไม่ได้อ่าน"
                          title="ยังไม่ได้อ่าน"
                          w={10}
                          h={10}
                          bg="red.6"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            right: 2,
                            transform: 'translateY(-50%)',
                            zIndex: 3,
                            borderRadius: '50%',
                          }}
                        />
                      )
                    }
                  >
                    {approvals && entry.kind === 'ยืม' && (
                      <Text size="xs" c={entry.pickupDate ? undefined : 'dimmed'}>
                        {pickupLabel(entry)}
                      </Text>
                    )}
                  </BorrowedEquipmentCard>
                );
              return (
                <Paper
                  key={`${entry.kind}-${entry.id}`}
                  withBorder
                  p="sm"
                  radius="lg"
                  style={{ position: 'relative' }}
                >
                  {unread && (
                    <Box
                      component="span"
                      role="img"
                      aria-label="ยังไม่ได้อ่าน"
                      title="ยังไม่ได้อ่าน"
                      w={10}
                      h={10}
                      bg="red.6"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 8,
                        transform: 'translate(50%, -50%)',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                  <Group wrap="wrap" gap="md" align="center">
                    <Group wrap="nowrap" style={{ flex: '2 1 240px', minWidth: 0 }}>
                      <Box
                        w={56}
                        bg="gray.0"
                        style={{ flexShrink: 0, borderRadius: 8, overflow: 'hidden' }}
                      >
                        <CatalogPhoto
                          key={entry.photo}
                          url={entry.photo}
                          name={entry.name}
                          height={56}
                        />
                      </Box>
                      <Stack gap={3} style={{ minWidth: 0 }}>
                        <Text fw={600} size="sm" lineClamp={2}>
                          {entry.name || entry.asset}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {entry.asset} · S/N: {entry.serial || '—'}
                        </Text>
                      </Stack>
                    </Group>
                    {approvals && (
                      <Stack gap={3} style={{ flex: '1 1 150px', minWidth: 0 }}>
                        <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
                          ผู้ขอ: {entry.borrower || '—'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ทีม: {entry.team || '—'}
                        </Text>
                      </Stack>
                    )}
                    <Stack gap={3} style={{ flex: '1 1 150px' }}>
                      <Text size="xs">
                        {entry.kind === 'ยืม' ? 'วันที่ยืม' : 'วันที่คืน'}:{' '}
                        {displayDate(entry.date)}
                      </Text>
                      {entry.due && <Text size="xs">กำหนดคืน: {displayDate(entry.due)}</Text>}
                      {countdown(entry) && (
                        <Text size="xs" fw={600} c={countdown(entry)!.color}>
                          {countdown(entry)!.text}
                        </Text>
                      )}
                    </Stack>
                    {approvals && entry.kind === 'ยืม' && (
                      <Text
                        size="xs"
                        c={entry.pickupDate ? undefined : 'dimmed'}
                        style={{ flex: '1 1 160px' }}
                      >
                        {pickupLabel(entry)}
                      </Text>
                    )}
                    <RequestStatusBadge record={entry} />
                    <Button size="xs" variant="outline" onClick={() => onOpenDetails(entry)}>
                      ดูรายละเอียด
                    </Button>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Stack>
      )}
    </>
  );
}
