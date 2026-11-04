'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { myRequestsSchema } from '@/types/account';
import { CatalogPhoto } from '@/features/lending/catalog-picker';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Button,
  Paper,
  Stack,
  Text,
  Badge,
  Box,
  Group,
  Title,
  Modal,
  Select,
  Tabs,
  SimpleGrid,
} from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { lendingStatusColor } from '@/lib/lending-status';
import { myRequestsService } from '@/services/my-requests.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function MyRequestsPage({ approvals = false }: { approvals?: boolean }) {
  const client = useQueryClient();
  const [requestKind, setRequestKind] = useState('ยืม');
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<
    z.infer<typeof myRequestsSchema>['records'][number] | null
  >(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const displayDate = (value: string) =>
    isIsoCalendarDate(value)
      ? new Date(value + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Bangkok',
        })
      : value || '—';
  const countdown = (entry: z.infer<typeof myRequestsSchema>['records'][number]) => {
    if (entry.kind !== 'ยืม' || entry.completed || !isIsoCalendarDate(entry.due)) return null;
    const days = calendarDaysBetween(today, entry.due);
    return {
      text:
        days < 0 ? `เกินกำหนด ${-days} วัน` : days === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${days} วัน`,
      color: days < 0 ? 'red' : days <= 2 ? 'yellow' : 'portalGreen',
    };
  };
  const { api, can, user } = useAuthSession();
  const requests = useQuery({
    queryKey: [approvals ? 'approval-requests' : 'my-requests', user?.id],
    queryFn: ({ signal }) =>
      approvals
        ? api.request('/api/approval-requests', myRequestsSchema, { signal })
        : myRequestsService.list(api, signal),
    enabled:
      !!user &&
      (approvals
        ? ['ADMIN', 'SUPER_ADMIN'].includes(user.role) && can('LOAN_VIEW_ALL')
        : can('LOAN_VIEW_OWN')),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.request(
        `/api/approval-requests/${encodeURIComponent(id)}`,
        z.object({ id: z.string() }),
        { method: 'PATCH', body: { status, kind: requestKind, condition: conditions[id] } },
      ),
    onSuccess: async (_result, variables) => {
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[variables.id];
        return next;
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['approval-requests'] }),
        client.invalidateQueries({ queryKey: ['my-requests'] }),
        client.invalidateQueries({ queryKey: ['loan-catalog'] }),
      ]);
    },
  });
  if (
    approvals &&
    (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role) || !can('LOAN_VIEW_ALL'))
  )
    return <Text>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</Text>;
  const visibleRequests = (requests.data?.records ?? []).filter(
    (entry) => !approvals || entry.kind === requestKind,
  );
  const summaryStatuses =
    requestKind === 'คืน'
      ? ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น']
      : ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ไม่อนุมัติ', 'ยกเลิก', 'กำลังยืม'];
  return (
    <Box component="section">
      <Group justify="space-between" align="center" className="dash-heading">
        <Title order={1}>{approvals ? 'คำขออนุมัติ' : 'รายการของฉัน'}</Title>
        <Button
          loading={requests.isFetching}
          onClick={() => {
            void requests.refetch();
          }}
        >
          โหลดรายการล่าสุด
        </Button>
      </Group>
      {approvals && (
        <Tabs
          value={requestKind}
          onChange={(value) => {
            if (value) setRequestKind(value);
          }}
          mb="md"
        >
          <Tabs.List>
            <Tabs.Tab value="ยืม">
              ยืม ({requests.data?.records.filter((entry) => entry.kind === 'ยืม').length ?? 0})
            </Tabs.Tab>
            <Tabs.Tab value="คืน">
              คืน ({requests.data?.records.filter((entry) => entry.kind === 'คืน').length ?? 0})
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      )}
      {approvals && (
        <SimpleGrid cols={{ base: 2, sm: 3, xl: 6 }} spacing="sm" mb="lg">
          {summaryStatuses.map((status) => (
            <Paper
              key={status}
              withBorder
              radius="md"
              p="md"
              style={{
                borderTop: `2px solid var(--mantine-color-${lendingStatusColor(status)}-5)`,
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                <Text size="sm">{status}</Text>
                <Text size="28px" fw={700} lh={1.2}>
                  {requests.isPending
                    ? '—'
                    : (
                        visibleRequests.filter(
                          (entry) =>
                            (entry.kind === 'คืน'
                              ? ((
                                  { รอรับคืน: 'รอดำเนินการ', รับคืนแล้ว: 'เสร็จสิ้น' } as Record<
                                    string,
                                    string
                                  >
                                )[entry.status] ?? entry.status)
                              : entry.status) === status,
                        ).length ?? 0
                      ).toLocaleString('th-TH')}
                </Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}
      <ErrorAlert error={requests.error} />
      <ErrorAlert error={update.error} />
      {requests.isPending ? (
        <LoadingIndicator />
      ) : (
        <Stack>
          <Text role="status">
            {visibleRequests.length
              ? `พบ ${visibleRequests.length} รายการ`
              : 'ยังไม่มีรายการของคุณ'}
          </Text>
          {visibleRequests.map((entry) => (
            <Paper key={`${entry.kind}-${entry.id}`} withBorder p="sm" radius="lg">
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
                    {entry.kind === 'ยืม' ? 'วันที่ยืม' : 'วันที่คืน'}: {displayDate(entry.date)}
                  </Text>
                  {entry.due && <Text size="xs">กำหนดคืน: {displayDate(entry.due)}</Text>}
                  {countdown(entry) && (
                    <Text size="xs" fw={600} c={countdown(entry)!.color}>
                      {countdown(entry)!.text}
                    </Text>
                  )}
                </Stack>
                <Badge
                  color={lendingStatusColor(
                    entry.completed && entry.kind === 'ยืม' ? 'เสร็จสิ้น' : entry.status,
                  )}
                >
                  {entry.completed && entry.kind === 'ยืม' ? 'เสร็จสิ้น' : entry.status || '—'}
                </Badge>
                {approvals && (
                  <Group gap="xs">
                    <Select
                      aria-label={`สถานะ ${entry.id}`}
                      w={170}
                      value={drafts[entry.id] ?? entry.status}
                      data={[...new Set([entry.status, ...summaryStatuses].filter(Boolean))]}
                      disabled={update.isPending || !can('LOAN_APPROVE')}
                      allowDeselect={false}
                      onChange={(status) => {
                        if (status) setDrafts((previous) => ({ ...previous, [entry.id]: status }));
                      }}
                    />
                    {entry.kind === 'คืน' && (drafts[entry.id] ?? entry.status) === 'เสร็จสิ้น' && (
                      <Select
                        aria-label={`สภาพหลังคืน ${entry.id}`}
                        placeholder="สภาพหลังคืน"
                        data={['ดี', 'ชำรุด']}
                        value={conditions[entry.id] || null}
                        onChange={(value) =>
                          setConditions((previous) => ({ ...previous, [entry.id]: value || '' }))
                        }
                        w={130}
                      />
                    )}
                    <Button
                      size="xs"
                      disabled={
                        !drafts[entry.id] ||
                        drafts[entry.id] === entry.status ||
                        update.isPending ||
                        !can('LOAN_APPROVE')
                      }
                      loading={update.isPending && update.variables?.id === entry.id}
                      onClick={() =>
                        update.mutate({ id: entry.id, status: drafts[entry.id] ?? entry.status })
                      }
                    >
                      บันทึก
                    </Button>
                  </Group>
                )}
                <Button size="xs" variant="outline" onClick={() => setDetails(entry)}>
                  ดูรายละเอียด
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
      <Modal
        opened={details !== null}
        onClose={() => setDetails(null)}
        title="รายละเอียดรายการของฉัน"
        centered
        size="lg"
      >
        {details && (
          <Stack>
            <CatalogPhoto key={details.photo} url={details.photo} name={details.name} />
            <Text fw={700}>{details.name || details.asset}</Text>
            <Badge
              color={lendingStatusColor(
                details.completed && details.kind === 'ยืม' ? 'เสร็จสิ้น' : details.status,
              )}
            >
              {details.completed && details.kind === 'ยืม' ? 'เสร็จสิ้น' : details.status || '—'}
            </Badge>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Text size="sm">เลขครุภัณฑ์: {details.asset}</Text>
              <Text size="sm">S/N: {details.serial || '—'}</Text>
              <Text size="sm">
                วันที่{details.kind}: {displayDate(details.date)}
              </Text>
              <Text size="sm">กำหนดคืน: {displayDate(details.due)}</Text>
            </SimpleGrid>
            {countdown(details) && (
              <Text c={countdown(details)!.color} fw={600}>
                {countdown(details)!.text}
              </Text>
            )}
            <Text size="sm">ผู้ขอ: {details.borrower || '—'}</Text>
            <Text size="sm">ทีม: {details.team || '—'}</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              เหตุผล: {details.purpose || '—'}
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              หมายเหตุ: {details.notes || '—'}
            </Text>
            <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              เลขคำขอ: {details.id}
            </Text>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
