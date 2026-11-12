'use client';
import { RefreshButton } from '@/components/core/action-buttons';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Group, Text, Badge, Box, Title } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { usersService } from '@/services/users.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { UsersFiltersForm, type UsersFilters } from './users-filters';
import { UsersList, type UserSelection } from './users-list';
import { UserDetailsDialog } from './user-details-dialog';

const emptyFilters: UsersFilters = { search: '', role: '', status: '' };
const pageSize = 10;
export function UsersPage() {
  const { api, can } = useAuthSession();
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<UserSelection | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const users = useQuery({
    queryKey: ['users', filters],
    queryFn: ({ signal }) => usersService.list(api, filters, signal),
    enabled: can('USER_VIEW'),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  const records = [...(users.data?.records ?? [])].sort(
    (a, b) =>
      (Date.parse(b.last_login_at || b.created_at) || 0) -
        (Date.parse(a.last_login_at || a.created_at) || 0) || a.name.localeCompare(b.name, 'th'),
  );
  const lastPage = Math.max(0, Math.ceil(records.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const applyFilters = (changes: Partial<UsersFilters>) => {
    setFilters({ ...filters, ...changes });
    setPage(0);
  };
  return (
    <Box component="section">
      <Group justify="space-between" align="center" className="dash-heading">
        <Title order={1}>ผู้ใช้งาน</Title>
        <RefreshButton
          loading={users.isFetching}
          onClick={() => {
            void users.refetch();
          }}
        />
      </Group>
      <UsersFiltersForm
        search={search}
        filters={filters}
        onSearchChange={setSearch}
        onFilterChange={applyFilters}
        onReset={() => {
          setSearch('');
          setFilters(emptyFilters);
          setPage(0);
        }}
      />
      <ErrorAlert error={users.error} />
      {users.isPending ? (
        <LoadingIndicator />
      ) : !records.length ? (
        <Text role="status">ไม่พบผู้ใช้งาน</Text>
      ) : (
        <>
          <Text component="div" role="status" my="md">
            บัญชีผู้ใช้งาน{' '}
            <Badge color="teal" variant="light" size="lg">
              {records.length}
            </Badge>
          </Text>
          <UsersList
            records={records.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
            canManage={can('USER_MANAGE')}
            onSelect={setSelected}
            now={now}
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
      {selected && (
        <UserDetailsDialog
          id={selected.id}
          editing={selected.editing}
          onClose={() => setSelected(null)}
        />
      )}
    </Box>
  );
}
