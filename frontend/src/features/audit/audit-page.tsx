'use client';
import { RefreshButton } from '@/components/core/action-buttons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Group, Text, Box, Title } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { auditService } from '@/services/audit.service';
import type { AuditEntry } from '@/types/account';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { AuditFilters } from './audit-filters';
import { AuditList } from './audit-list';
import { AuditDetailsDialog } from './audit-details-dialog';

export function AuditPage() {
  const { api, can } = useAuthSession();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: ({ signal }) => auditService.list(api, signal),
    enabled: can('AUDIT_VIEW'),
  });
  const records = audit.data?.records ?? [];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = records.filter(
    (entry) =>
      (!action || entry.action === action) &&
      (!type || entry.entity_type === type) &&
      terms.every((term) =>
        [
          entry.actor_name_snapshot,
          entry.actor_email_snapshot,
          entry.entity_id,
          entry.action,
          entry.entity_type,
        ].some((value) => value.toLowerCase().includes(term)),
      ),
  );
  const actions = [...new Set(records.map((entry) => entry.action).filter(Boolean))].sort();
  const types = [...new Set(records.map((entry) => entry.entity_type).filter(Boolean))].sort();
  const pageSize = 10;
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <Box component="section">
      <Group justify="space-between" align="center" className="dash-heading">
        <Title order={1}>Audit Log</Title>
        <RefreshButton
          loading={audit.isFetching}
          onClick={() => {
            void audit.refetch();
          }}
        />
      </Group>
      <AuditFilters
        query={query}
        action={action}
        type={type}
        actions={actions}
        types={types}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
        onActionChange={(value) => {
          setAction(value);
          setPage(0);
        }}
        onTypeChange={(value) => {
          setType(value);
          setPage(0);
        }}
        onReset={() => {
          setQuery('');
          setAction('');
          setType('');
          setPage(0);
        }}
      />
      <ErrorAlert error={audit.error} onRefresh={() => audit.refetch()} />
      {audit.isPending ? (
        <LoadingIndicator />
      ) : (
        <>
          <Text role="status" my="md">
            แสดง {matches.length} จาก {records.length} รายการล่าสุด
          </Text>
          {!matches.length ? (
            <Text>
              {records.length
                ? 'ไม่พบรายการที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง'
                : 'ยังไม่มีประวัติการใช้งาน'}
            </Text>
          ) : (
            <>
              <AuditList
                records={matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
                onSelect={setSelected}
              />
              <Group justify="space-between" wrap="nowrap" gap="xs" my="md">
                <Button
                  variant="default"
                  disabled={!currentPage}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ก่อนหน้า
                </Button>
                <Text size="sm" ta="center">
                  หน้า {currentPage + 1} / {lastPage + 1}
                </Text>
                <Button
                  variant="default"
                  disabled={currentPage >= lastPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  ถัดไป
                </Button>
              </Group>
            </>
          )}
        </>
      )}
      {selected && <AuditDetailsDialog selected={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
