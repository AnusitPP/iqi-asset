'use client';
import { RefreshButton, ResetFiltersButton } from '@/components/core/action-buttons';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { CalendarDays, Clock } from 'lucide-react';
import 'dayjs/locale/th';
import { bangkokIsoDate } from '@shared/core/extensions/dates.js';
import { SearchInput } from '@/components/core/search-input';
import { useEffect, useState } from 'react';
import { Layers, ClipboardCheck, MessageSquare, Save } from 'lucide-react';
import { CopyableText } from '@/components/core/copyable-text';
import { ViewToggle } from '@/components/core/view-toggle';
import styles from '@/components/core/request-details.module.css';
import { z } from 'zod';
import { myRequestsSchema } from '@/types/account';
import { CatalogPhoto } from '@/components/core/catalog-photo';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Checkbox,
  Button,
  Paper,
  Stack,
  Text,
  Textarea,
  Box,
  Group,
  Title,
  Modal,
  Select,
  Tabs,
  SimpleGrid,
} from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { BorrowedEquipmentCard } from '@/components/core/borrowed-equipment-card';
import { RequestDetailsSummary } from '@/components/core/request-details-summary';
import { RequestStatusBadge } from '@/components/core/request-status-badge';
import {
  approvalStatuses,
  requestStatusValue,
  requestStatusPresentation,
} from '@shared/features/lending/status.js';
import { lendingStatusColor } from '@/lib/lending-status';
import { myRequestsService } from '@/services/my-requests.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function MyRequestsPage({ approvals = false }: { approvals?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentLoansOnly, setCurrentLoansOnly] = useState(true);
  const [requestKind, setRequestKind] = useState('ยืม');
  const [statusFilter, setStatusFilter] = useState(approvals ? 'รอดำเนินการ' : '');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState(approvals ? 'newest' : 'due');
  const [conditionError, setConditionError] = useState('');
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const pickupIncomplete =
    Boolean(pickupDate || pickupTime) &&
    (!isIsoCalendarDate(pickupDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<
    z.infer<typeof myRequestsSchema>['records'][number] | null
  >(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = bangkokIsoDate(now);
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
  const pickupLabel = (entry: z.infer<typeof myRequestsSchema>['records'][number]) =>
    entry.pickupDate
      ? `มารับ: ${displayDate(entry.pickupDate)}${entry.pickupTime ? ` เวลา ${entry.pickupTime} น.` : ''}`
      : 'ยังไม่ระบุวันรับ';
  const { api, can, user } = useAuthSession();
  const readKey = user ? `request-reads:${user.id}:${approvals ? 'approvals' : 'own'}` : '';
  const [readState, setReadState] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  useEffect(() => {
    if (!readKey) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(readKey) ?? '[]');
      setReadState({
        key: readKey,
        ids: Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [],
      });
    } catch {
      setReadState({ key: readKey, ids: [] });
    }
  }, [readKey]);
  const openDetails = (entry: z.infer<typeof myRequestsSchema>['records'][number]) => {
    setDetails(entry);
    setComment(entry.adminComment);
    setPickupDate(entry.pickupDate);
    setPickupTime(entry.pickupTime);
    setConditionError('');
    update.reset();
    const id = `${entry.kind}:${entry.id}`;
    const ids = [...new Set([...(readState.key === readKey ? readState.ids : []), id])];
    setReadState({ key: readKey, ids });
    try {
      localStorage.setItem(readKey, JSON.stringify(ids));
    } catch {
      /* Reading still works when storage is unavailable. */
    }
  };
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
        {
          method: 'PATCH',
          body: {
            status,
            kind: requestKind,
            condition: conditions[id],
            adminComment: comment,
            ...(details?.kind === 'ยืม' ? { pickupDate, pickupTime } : {}),
          },
        },
      ),
    onSuccess: async (_result, variables) => {
      setDetails(null);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[variables.id];
        return next;
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['approval-requests'] }),
        client.invalidateQueries({ queryKey: ['my-requests'] }),
        client.invalidateQueries({ queryKey: ['loan-catalog'] }),
        client.invalidateQueries({ queryKey: ['return-catalog'] }),
      ]);
    },
  });
  if (
    approvals &&
    (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role) || !can('LOAN_VIEW_ALL'))
  )
    return <Text>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</Text>;
  const kindRequests = (requests.data?.records ?? []).filter(
    (entry) => !approvals || entry.kind === requestKind,
  );
  const displayStatus = requestStatusValue;
  const searchTerms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const dueTime = (entry: z.infer<typeof myRequestsSchema>['records'][number]) =>
    entry.kind === 'ยืม' &&
    !entry.completed &&
    !['ไม่อนุมัติ', 'ยกเลิก', 'เสร็จสิ้น'].includes(entry.status) &&
    isIsoCalendarDate(entry.due)
      ? Date.parse(entry.due)
      : Infinity;
  const visibleRequests = kindRequests
    .filter(
      (entry) =>
        approvals ||
        !currentLoansOnly ||
        (entry.kind === 'ยืม' &&
          !entry.completed &&
          ['กำลังยืม', 'รอดำเนินการคืน'].includes(entry.status)),
    )
    .filter(
      (entry) =>
        approvals ||
        searchTerms.every((term) =>
          [
            entry.name,
            entry.asset,
            entry.serial,
            entry.id,
            requestStatusPresentation(displayStatus(entry)).label,
            entry.status,
            entry.notes,
            entry.adminComment,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(term),
        ),
    )
    .filter((entry) => !approvals || !statusFilter || displayStatus(entry) === statusFilter)
    .sort((a, b) =>
      sort === 'due'
        ? dueTime(a) === dueTime(b)
          ? b.order - a.order
          : dueTime(a) < dueTime(b)
            ? -1
            : 1
        : sort === 'oldest'
          ? a.order - b.order
          : sort === 'name'
            ? a.name.localeCompare(b.name, 'th')
            : b.order - a.order,
    );
  const summaryStatuses = approvalStatuses(requestKind);
  return (
    <Box component="section">
      <Group justify="space-between" align="center" className="dash-heading">
        <Title order={1}>{approvals ? 'คำขออนุมัติ' : 'รายการของฉัน'}</Title>
        <RefreshButton
          loading={requests.isFetching}
          onClick={() => {
            void requests.refetch();
          }}
        />
      </Group>
      {approvals && (
        <Tabs
          value={requestKind}
          onChange={(value) => {
            if (value) {
              setRequestKind(value);
              setStatusFilter('รอดำเนินการ');
            }
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
              component="button"
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter((previous) => (previous === status ? '' : status))}
              bg={statusFilter === status ? 'portalGreen.0' : undefined}
              withBorder
              radius="md"
              p="md"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                borderTop: `2px solid var(--mantine-color-${lendingStatusColor(status)}-5)`,
              }}
            >
              <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                <Text size="sm">{requestStatusPresentation(status).label}</Text>
                <Text size="28px" fw={700} lh={1.2}>
                  {requests.isPending
                    ? '—'
                    : kindRequests
                        .filter((entry) => displayStatus(entry) === status)
                        .length.toLocaleString('th-TH')}
                </Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}
      {approvals && (
        <Group justify="space-between" mb="md">
          <Button variant="light" onClick={() => setStatusFilter('')} disabled={!statusFilter}>
            แสดงทุกสถานะ
          </Button>
          <Select
            label="เรียงลำดับ"
            value={sort}
            allowDeselect={false}
            onChange={(value) => {
              if (value) setSort(value);
            }}
            data={[
              { value: 'newest', label: 'ใหม่สุดก่อน' },
              { value: 'oldest', label: 'เก่าสุดก่อน' },
              { value: 'name', label: 'ชื่ออุปกรณ์' },
            ]}
          />
        </Group>
      )}
      {!approvals && (
        <Paper withBorder p="md" radius="lg" mb="md">
          <Stack gap="sm">
            <Group align="flex-end" gap="lg">
              <SearchInput
                style={{ flex: '1 1 320px' }}
                label="ค้นหารายการของฉัน"
                placeholder="ชื่ออุปกรณ์ เลขครุภัณฑ์ S/N หรือเลขคำขอ"
                iconSize={18}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Group gap="xs" wrap="nowrap">
                <Select
                  id="own-request-sort"
                  aria-label="เรียงลำดับรายการของฉัน"
                  w={170}
                  value={sort}
                  allowDeselect={false}
                  onChange={(value) => {
                    if (value) setSort(value);
                  }}
                  data={[
                    { value: 'due', label: 'ใกล้กำหนดคืนก่อน' },
                    { value: 'newest', label: 'ใหม่สุดก่อน' },
                    { value: 'oldest', label: 'เก่าสุดก่อน' },
                    { value: 'name', label: 'ชื่ออุปกรณ์' },
                  ]}
                />
              </Group>
              <Group gap="xs" wrap="nowrap">
                <ViewToggle value={view} onChange={setView} />
                <ResetFiltersButton
                  onClick={() => {
                    setSearch('');
                    setSort('due');
                    setCurrentLoansOnly(true);
                  }}
                />
              </Group>
            </Group>
            <Checkbox
              label="แสดงรายการที่ยืมปัจจุบัน"
              checked={currentLoansOnly}
              onChange={(event) => setCurrentLoansOnly(event.currentTarget.checked)}
            />
          </Stack>
        </Paper>
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
              : approvals
                ? 'ยังไม่มีรายการของคุณ'
                : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
          </Text>
          <SimpleGrid
            cols={approvals || view === 'list' ? 1 : { base: 1, xs: 2, sm: 3, lg: 4, xl: 6 }}
            spacing="sm"
          >
            {visibleRequests.map((entry) =>
              !approvals && view === 'grid' ? (
                <BorrowedEquipmentCard
                  key={`${entry.kind}-${entry.id}`}
                  record={entry}
                  id={entry.id}
                  today={today}
                  action={
                    <Button fullWidth size="sm" onClick={() => openDetails(entry)}>
                      ดูรายละเอียด
                    </Button>
                  }
                  categoryIndicator={
                    readState.key === readKey &&
                    !readState.ids.includes(`${entry.kind}:${entry.id}`) && (
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
                  {entry.kind === 'ยืม' && (
                    <Text size="xs" c={entry.pickupDate ? undefined : 'dimmed'}>
                      {pickupLabel(entry)}
                    </Text>
                  )}
                </BorrowedEquipmentCard>
              ) : (
                <Paper
                  key={`${entry.kind}-${entry.id}`}
                  withBorder
                  p="sm"
                  radius="lg"
                  style={{ position: 'relative' }}
                >
                  {readState.key === readKey &&
                    !readState.ids.includes(`${entry.kind}:${entry.id}`) && (
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
                    {entry.kind === 'ยืม' && (
                      <Text
                        size="xs"
                        c={entry.pickupDate ? undefined : 'dimmed'}
                        style={{ flex: '1 1 160px' }}
                      >
                        {pickupLabel(entry)}
                      </Text>
                    )}
                    <RequestStatusBadge record={entry} />
                    <Button size="xs" variant="outline" onClick={() => openDetails(entry)}>
                      ดูรายละเอียด
                    </Button>
                  </Group>
                </Paper>
              ),
            )}
          </SimpleGrid>
        </Stack>
      )}
      <Modal
        opened={details !== null}
        onClose={() => setDetails(null)}
        title={
          <Group gap="sm">
            <Box className={styles.titleIcon}>
              <Layers size={22} aria-hidden="true" />
            </Box>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={700} size="lg">
                รายละเอียดรายการของฉัน
              </Text>
              {details && (
                <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                  เลขคำขอ: <CopyableText key={details.id} value={details.id} />
                </Text>
              )}
            </Stack>
          </Group>
        }
        classNames={{ header: styles.header, body: styles.body, content: styles.content }}
        centered
        size={680}
      >
        {details && (
          <Stack gap="sm">
            <RequestDetailsSummary record={details} today={today} />
            {details.kind === 'ยืม' && approvals && !details.statusLocked ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <DatePickerInput
                  label="วันที่มารับ"
                  placeholder="เลือกวันที่มารับ"
                  locale="th"
                  valueFormat="DD MMMM YYYY"
                  firstDayOfWeek={0}
                  defaultDate={pickupDate || today}
                  minDate={today}
                  highlightToday
                  getDayProps={(date) => ({ autoFocus: date === (pickupDate || today) })}
                  value={pickupDate || null}
                  onChange={(value) => setPickupDate(value || '')}
                  clearable
                  disabled={update.isPending || !can('LOAN_APPROVE')}
                  leftSection={<CalendarDays size={16} aria-hidden="true" />}
                  popoverProps={{ withinPortal: true, zIndex: 400, radius: 'lg', shadow: 'md' }}
                  previousLabel="เดือนก่อนหน้า"
                  nextLabel="เดือนถัดไป"
                />
                <TimePicker
                  label="เวลามารับ"
                  description="เวลาไทย (24 ชั่วโมง)"
                  inputWrapperOrder={['label', 'input', 'description', 'error']}
                  value={pickupTime}
                  onChange={setPickupTime}
                  format="24h"
                  withDropdown
                  hoursStep={1}
                  minutesStep={1}
                  hoursInputLabel="ชั่วโมงมารับ"
                  minutesInputLabel="นาทีมารับ"
                  clearable
                  clearButtonProps={{ 'aria-label': 'ล้างเวลามารับ' }}
                  error={pickupIncomplete ? 'กรุณาเลือกวันและเวลามารับให้ครบ' : undefined}
                  disabled={update.isPending || !can('LOAN_APPROVE')}
                  leftSection={<Clock size={16} aria-hidden="true" />}
                  popoverProps={{ withinPortal: true, zIndex: 400, radius: 'lg', shadow: 'md' }}
                />
              </SimpleGrid>
            ) : (
              details.kind === 'ยืม' && <Text size="sm">{pickupLabel(details)}</Text>
            )}
            {approvals && !details.statusLocked && (
              <Stack className={styles.controls}>
                <Box className={styles.statusRow}>
                  <Group gap="sm">
                    <ClipboardCheck className={styles.orangeIcon} aria-hidden="true" />
                    <Text fw={700}>สถานะรายการ</Text>
                  </Group>
                  <Select
                    aria-label={`สถานะ ${details.id}`}
                    classNames={{ input: styles.statusInput }}
                    value={drafts[details.id] ?? details.status}
                    data={[
                      ...new Set(
                        [
                          ...(details.status === 'กำลังดำเนินการ' ? [] : [details.status]),
                          ...summaryStatuses,
                        ].filter(Boolean),
                      ),
                    ].map((value) => ({
                      value,
                      label: requestStatusPresentation(value).label,
                    }))}
                    disabled={update.isPending || !can('LOAN_APPROVE')}
                    allowDeselect={false}
                    onChange={(status) => {
                      setConditionError('');
                      if (status) setDrafts((previous) => ({ ...previous, [details.id]: status }));
                    }}
                  />
                </Box>
                {details.kind === 'คืน' &&
                  (drafts[details.id] ?? details.status) === 'เสร็จสิ้น' && (
                    <Select
                      aria-label={`สภาพหลังคืน ${details.id}`}
                      placeholder="สภาพหลังคืน"
                      data={['ดี', 'ชำรุด']}
                      value={conditions[details.id] || null}
                      onChange={(value) => {
                        setConditions((previous) => ({ ...previous, [details.id]: value || '' }));
                        setConditionError('');
                      }}
                      aria-invalid={conditionError === details.id}
                      aria-describedby={
                        conditionError === details.id ? 'return-condition-error' : undefined
                      }
                      w={130}
                    />
                  )}
                <Textarea
                  label={
                    <Group gap="sm">
                      <MessageSquare className={styles.orangeIcon} aria-hidden="true" />
                      <Text fw={700}>คอมเมนต์จากแอดมิน</Text>
                    </Group>
                  }
                  value={comment}
                  onChange={(event) => setComment(event.currentTarget.value)}
                  maxLength={2000}
                  minRows={2}
                  autosize
                  size="sm"
                  disabled={update.isPending || !can('LOAN_APPROVE')}
                />
                <ErrorAlert error={update.error} />
                <Group justify="flex-end" className={styles.footer}>
                  <Button
                    size="sm"
                    className={styles.saveButton}
                    leftSection={<Save size={19} aria-hidden="true" />}
                    disabled={
                      ((drafts[details.id] ?? details.status) === details.status &&
                        comment === details.adminComment &&
                        pickupDate === details.pickupDate &&
                        pickupTime === details.pickupTime) ||
                      update.isPending ||
                      (details.kind === 'ยืม' && pickupIncomplete) ||
                      !can('LOAN_APPROVE')
                    }
                    loading={update.isPending && update.variables?.id === details.id}
                    onClick={() => {
                      const status = drafts[details.id] ?? details.status;
                      if (
                        details.kind === 'คืน' &&
                        status === 'เสร็จสิ้น' &&
                        !conditions[details.id]
                      ) {
                        setConditionError(details.id);
                        return;
                      }
                      setConditionError('');
                      update.mutate({ id: details.id, status });
                    }}
                  >
                    บันทึก
                  </Button>
                </Group>
              </Stack>
            )}
            {(!approvals || details.statusLocked) && (
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                คอมเมนต์จากแอดมิน: {details.adminComment || '—'}
              </Text>
            )}

            {conditionError === details.id && (
              <Text id="return-condition-error" role="alert" size="xs" c="red" mt={-8}>
                กรุณาระบุสภาพหลังคืน
              </Text>
            )}
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
