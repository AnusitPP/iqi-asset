'use client';
import {
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { SearchInput } from '@/components/core/search-input';
import { ResetFiltersButton } from '@/components/core/action-buttons';
import { ViewToggle } from '@/components/core/view-toggle';
import { lendingStatusColor } from '@/lib/lending-status';
import { requestStatusPresentation, requestStatusValue } from '@shared/features/lending/status.js';
import type { myRequestsSchema } from '@/types/account';
import type { z } from 'zod';

type RequestRecord = z.infer<typeof myRequestsSchema>['records'][number];

export function RequestFilters({
  approvals,
  requestKind,
  setRequestKind,
  loanCount,
  returnCount,
  summaryStatuses,
  records,
  requestsPending,
  statusFilter,
  setStatusFilter,
  sort,
  setSort,
  search,
  setSearch,
  view,
  setView,
  currentLoansOnly,
  setCurrentLoansOnly,
}: {
  approvals: boolean;
  requestKind: string;
  setRequestKind: (value: string) => void;
  loanCount: number;
  returnCount: number;
  summaryStatuses: string[];
  records: RequestRecord[];
  requestsPending: boolean;
  statusFilter: string;
  setStatusFilter: (value: string | ((previous: string) => string)) => void;
  sort: string;
  setSort: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  view: string;
  setView: (value: string) => void;
  currentLoansOnly: boolean;
  setCurrentLoansOnly: (value: boolean) => void;
}) {
  const displayStatus = requestStatusValue;
  return (
    <>
      {approvals && (
        <>
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
              <Tabs.Tab value="ยืม">ยืม ({loanCount})</Tabs.Tab>
              <Tabs.Tab value="คืน">คืน ({returnCount})</Tabs.Tab>
            </Tabs.List>
          </Tabs>
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
                variant="light"
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderTop: `2px solid var(--mantine-color-${lendingStatusColor(status)}-5)`,
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                  <Text size="sm">{requestStatusPresentation(status).label}</Text>
                  <Text size="28px" fw={700} lh={1.2}>
                    {requestsPending
                      ? '—'
                      : records
                          .filter((entry) => displayStatus(entry) === status)
                          .length.toLocaleString('th-TH')}
                  </Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
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
        </>
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
    </>
  );
}
