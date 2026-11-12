'use client';
import { RefreshButton } from '@/components/core/action-buttons';
import 'dayjs/locale/th';
import { bangkokIsoDate } from '@shared/core/extensions/dates.js';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { myRequestsSchema } from '@/types/account';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Box, Group, Text, Title } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { RequestDetailsModal } from './request-details-modal';
import { RequestList } from './request-list';
import { RequestFilters } from './request-filters';
import {
  approvalStatuses,
  requestStatusValue,
  requestStatusPresentation,
  isReturnPending,
} from '@shared/features/lending/status.js';
import { myRequestsService } from '@/services/my-requests.service';
export function MyRequestsPage({ approvals = false }: { approvals?: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentLoansOnly, setCurrentLoansOnly] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
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
    if (!approvals && isReturnPending(entry)) return { text: 'รอดำเนินการ', color: 'blue' };
    if (approvals && entry.status !== 'กำลังยืม') return null;
    if (entry.kind !== 'ยืม' || entry.completed || !isIsoCalendarDate(entry.due)) return null;
    const days = calendarDaysBetween(today, entry.due);
    return {
      text:
        days < 0 ? `เกินกำหนด ${-days} วัน` : days === 0 ? 'กำหนดคืนวันนี้' : `เหลือ ${days} วัน`,
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
  const allRequests = requests.data?.records ?? [];
  const loanKeys = new Set(
    allRequests
      .filter((entry) => entry.kind === 'ยืม')
      .map((entry) => JSON.stringify([entry.id, entry.itemId])),
  );
  const kindRequests = allRequests.filter((entry) =>
    approvals
      ? entry.kind === requestKind
      : entry.kind !== 'คืน' ||
        !entry.loanId ||
        !entry.itemId ||
        !loanKeys.has(JSON.stringify([entry.loanId, entry.itemId])),
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
        showCompleted ||
        !['เสร็จสิ้น', 'รับคืนแล้ว', 'คืนแล้ว'].includes(displayStatus(entry)),
    )
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
      <RequestFilters
        approvals={approvals}
        requestKind={requestKind}
        setRequestKind={setRequestKind}
        loanCount={requests.data?.records.filter((entry) => entry.kind === 'ยืม').length ?? 0}
        returnCount={requests.data?.records.filter((entry) => entry.kind === 'คืน').length ?? 0}
        summaryStatuses={summaryStatuses}
        records={kindRequests}
        requestsPending={requests.isPending}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sort={sort}
        setSort={setSort}
        search={search}
        setSearch={setSearch}
        view={view}
        setView={setView}
        currentLoansOnly={currentLoansOnly}
        setCurrentLoansOnly={setCurrentLoansOnly}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
      />
      <RequestList
        approvals={approvals}
        view={view}
        pending={requests.isPending}
        error={requests.error}
        updateError={update.error}
        records={visibleRequests}
        today={today}
        readKey={readKey}
        readStateKey={readState.key}
        readIds={readState.ids}
        displayDate={displayDate}
        countdown={countdown}
        pickupLabel={pickupLabel}
        onOpenDetails={openDetails}
      />
      <RequestDetailsModal
        details={details}
        approvals={approvals}
        today={today}
        onClose={() => setDetails(null)}
        canApprove={can('LOAN_APPROVE')}
        saving={update.isPending}
        savingId={update.variables?.id}
        updateError={update.error}
        summaryStatuses={summaryStatuses}
        drafts={drafts}
        onDraftStatusChange={(id, status) =>
          setDrafts((previous) => ({ ...previous, [id]: status }))
        }
        conditions={conditions}
        onConditionChange={(id, condition) =>
          setConditions((previous) => ({ ...previous, [id]: condition }))
        }
        conditionError={conditionError}
        setConditionError={setConditionError}
        comment={comment}
        setComment={setComment}
        pickupDate={pickupDate}
        setPickupDate={setPickupDate}
        pickupTime={pickupTime}
        setPickupTime={setPickupTime}
        pickupIncomplete={pickupIncomplete}
        pickupLabel={pickupLabel}
        onSave={(id, status) => update.mutate({ id, status })}
      />
    </Box>
  );
}
