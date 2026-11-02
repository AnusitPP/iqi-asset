'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Group,
  Stack,
  Paper,
  TextInput,
  NativeSelect,
  Table,
  Text,
  Modal,
  Badge,
} from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { usersService } from '@/services/users.service';
import {
  roleSchema,
  userStatusSchema,
  type AccountUser,
  type AccountRole,
  type AccountStatus,
} from '@/types/account';
import { formatAccountTimestamp } from '@/lib/account-display';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/providers/toast-provider';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';

const emptyFilters = { search: '', role: '', status: '' };
const pageSize = 10;
export function UsersPage() {
  const { api, can } = useAuthSession();
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ id: string; editing: boolean } | null>(null);
  const users = useQuery({
    queryKey: ['users', filters],
    queryFn: ({ signal }) => usersService.list(api, filters, signal),
    enabled: can('USER_VIEW'),
  });
  const records = [...(users.data?.records ?? [])].sort(
    (a, b) =>
      (Date.parse(b.last_login_at || b.created_at) || 0) -
        (Date.parse(a.last_login_at || a.created_at) || 0) || a.name.localeCompare(b.name, 'th'),
  );
  const lastPage = Math.max(0, Math.ceil(records.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const applyFilters = (changes: Partial<typeof emptyFilters>) => {
    setFilters({ ...filters, ...changes });
    setPage(0);
  };
  return (
    <section>
      <div className="dash-heading">
        <h1>ผู้ใช้งาน</h1>
        <Button
          loading={users.isFetching}
          onClick={() => {
            void users.refetch();
          }}
        >
          โหลดผู้ใช้งานล่าสุด
        </Button>
      </div>
      <Paper withBorder p="lg" radius="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ search });
          }}
        >
          <Group align="end">
            <TextInput
              label="ค้นหาผู้ใช้งาน"
              placeholder="ชื่อหรืออีเมล"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <NativeSelect
              label="สิทธิ์ผู้ใช้งาน"
              data={[{ value: '', label: 'ทุกสิทธิ์' }, ...roleSchema.options]}
              value={filters.role}
              onChange={(event) => applyFilters({ role: event.currentTarget.value })}
            />
            <NativeSelect
              label="สถานะผู้ใช้งาน"
              data={[{ value: '', label: 'ทุกสถานะ' }, ...userStatusSchema.options]}
              value={filters.status}
              onChange={(event) => applyFilters({ status: event.currentTarget.value })}
            />
            <Button type="submit">ค้นหา</Button>
            <Button
              variant="default"
              onClick={() => {
                setSearch('');
                setFilters(emptyFilters);
                setPage(0);
              }}
            >
              ล้างตัวกรอง
            </Button>
          </Group>
        </form>
      </Paper>
      <ErrorAlert error={users.error} />
      {users.isPending ? (
        <LoadingIndicator />
      ) : !records.length ? (
        <Text role="status">ไม่พบผู้ใช้งาน</Text>
      ) : (
        <>
          <Text role="status" my="md">
            แสดง {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, records.length)} จาก {records.length} บัญชี ·
            เรียงตามการเข้าใช้ล่าสุด
          </Text>
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ผู้ใช้งาน</Table.Th>
                  <Table.Th>สิทธิ์</Table.Th>
                  <Table.Th>สถานะ</Table.Th>
                  <Table.Th>เข้าใช้ล่าสุด</Table.Th>
                  <Table.Th>จัดการ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Group wrap="nowrap">
                        <UserAvatar name={user.name} url={user.avatar_url} />
                        <div>
                          <Text fw={600}>{user.name}</Text>
                          <Text size="sm">{user.email}</Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{user.role}</Table.Td>
                    <Table.Td>
                      <Badge color={user.status === 'ACTIVE' ? 'green' : 'gray'}>
                        {user.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatAccountTimestamp(user.last_login_at)}</Table.Td>
                    <Table.Td>
                      <Group>
                        <Button
                          variant="subtle"
                          onClick={() => setSelected({ id: user.id, editing: false })}
                        >
                          รายละเอียด
                        </Button>
                        {can('USER_MANAGE') && user.role !== 'SUPER_ADMIN' && (
                          <Button
                            variant="light"
                            onClick={() => setSelected({ id: user.id, editing: true })}
                          >
                            จัดการสิทธิ์
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group justify="space-between" my="md">
            <Button
              variant="default"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              ก่อนหน้า
            </Button>
            <Text>
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
        <UserDetails
          id={selected.id}
          editing={selected.editing}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function UserDetails({
  id,
  editing,
  onClose,
}: {
  id: string;
  editing: boolean;
  onClose: () => void;
}) {
  const { api } = useAuthSession();
  const detail = useQuery({
    queryKey: ['user', id],
    queryFn: ({ signal }) => usersService.detail(api, id, signal),
    staleTime: 0,
  });
  return (
    <Modal
      opened
      onClose={onClose}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={editing ? 'จัดการสิทธิ์ผู้ใช้งาน' : 'ข้อมูลผู้ใช้งาน'}
      size="lg"
    >
      {detail.isPending ? (
        <LoadingIndicator />
      ) : detail.data ? (
        <UserAccessEditor key={id} user={detail.data.user} editing={editing} onClose={onClose} />
      ) : (
        <>
          <ErrorAlert error={detail.error} />
          <Button
            onClick={() => {
              void detail.refetch();
            }}
          >
            ลองอีกครั้ง
          </Button>
        </>
      )}
      {!detail.data && (
        <Button variant="default" onClick={onClose}>
          ปิด
        </Button>
      )}
    </Modal>
  );
}
function UserAccessEditor({
  user,
  editing,
  onClose,
}: {
  user: AccountUser;
  editing: boolean;
  onClose: () => void;
}) {
  const { api, can } = useAuthSession();
  const client = useQueryClient();
  const { showToast } = useToast();
  const isSaveCurrent = useSessionTaskGuard();
  const [role, setRole] = useState<AccountRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const editable = editing && can('USER_MANAGE') && user.role !== 'SUPER_ADMIN';
  const save = useMutation({
    mutationFn: async () => {
      if (!editable) throw new Error('ไม่มีสิทธิ์แก้ไขผู้ใช้งานนี้');
      if (role !== user.role) {
        const result = await usersService.updateRole(api, user.id, role);
        if (!isSaveCurrent()) return;
        client.setQueryData(['user', user.id], result);
      }
      if (status !== user.status) {
        const result = await usersService.updateStatus(api, user.id, status);
        if (!isSaveCurrent()) return;
        client.setQueryData(['user', user.id], result);
      }
    },
    onSuccess: async () => {
      if (!isSaveCurrent()) return;
      showToast('บันทึกสิทธิ์ผู้ใช้งานแล้ว');
      await client.invalidateQueries({ queryKey: ['users'] });
      await client.invalidateQueries({ queryKey: ['audit'] });
      if (isSaveCurrent()) onClose();
    },
    onError: async () => {
      if (!isSaveCurrent()) return;
      await client.invalidateQueries({ queryKey: ['audit'] });
      await client.invalidateQueries({ queryKey: ['users'] });
    },
  });
  return (
    <Stack>
      <Group>
        <UserAvatar name={user.name} url={user.avatar_url} />
        <div>
          <Text fw={700}>{user.name}</Text>
          <Text>{user.email}</Text>
        </div>
      </Group>
      <Text>
        Role: {user.role} · สถานะ: {user.status}
      </Text>
      <Text>เข้าใช้ครั้งแรก: {formatAccountTimestamp(user.created_at)}</Text>
      <Text>เข้าใช้ล่าสุด: {formatAccountTimestamp(user.last_login_at)}</Text>
      {user.role === 'SUPER_ADMIN' && (
        <Text>บัญชีหลักของระบบ · ไม่สามารถลดสิทธิ์หรือปิดบัญชีได้</Text>
      )}
      {editable && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <Stack>
            <NativeSelect
              label="Role"
              data={['STAFF', 'ADMIN']}
              value={role}
              onChange={(event) => setRole(roleSchema.parse(event.currentTarget.value))}
              disabled={save.isPending}
            />
            <NativeSelect
              label="สถานะ"
              data={userStatusSchema.options}
              value={status}
              onChange={(event) => setStatus(userStatusSchema.parse(event.currentTarget.value))}
              disabled={save.isPending}
            />
            <Button
              type="submit"
              loading={save.isPending}
              disabled={role === user.role && status === user.status}
            >
              บันทึกสิทธิ์
            </Button>
          </Stack>
        </form>
      )}
      <ErrorAlert error={save.error} />
      <Button variant="default" disabled={save.isPending} onClick={onClose}>
        ปิด
      </Button>
    </Stack>
  );
}
