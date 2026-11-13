'use client';
import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Divider, Group, Stack, NativeSelect, Text, Box, SimpleGrid } from '@mantine/core';
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
import { ErrorPopup } from '@/components/core/error-popup';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useToast } from '@/providers/toast-provider';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { UserRoleBadge } from './user-role-badge';

export function UserAccessEditor({
  user,
  editing,
  onClose,
}: {
  user: AccountUser;
  editing: boolean;
  onClose: () => void;
}) {
  const { api, can } = useAuthSession();
  const formId = useId();
  const client = useQueryClient();
  const { showToast } = useToast();
  const isSaveCurrent = useSessionTaskGuard();
  const [role, setRole] = useState<AccountRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const editable = editing && can('USER_MANAGE') && user.role !== 'SUPER_ADMIN';
  const save = useMutation({
    mutationKey: ['user-access', user.id],
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
    <Stack gap="lg">
      <Group wrap="nowrap">
        <UserAvatar name={user.name} url={user.avatar_url} />
        <Box miw={0}>
          <Text size="sm" fw={700} style={{ overflowWrap: 'anywhere' }}>
            {user.name}
          </Text>
          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {user.email}
          </Text>
        </Box>
      </Group>
      <Stack gap="xs">
        {[
          ['Role', user.role],
          ['สถานะ', user.status],
          ['เข้าใช้ครั้งแรก', formatAccountTimestamp(user.created_at)],
          ['เข้าใช้ล่าสุด', formatAccountTimestamp(user.last_login_at)],
        ].map(([label, value]) => (
          <SimpleGrid
            key={label}
            cols={2}
            spacing="sm"
            style={{ gridTemplateColumns: '110px minmax(0, 1fr)' }}
          >
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            {label === 'Role' ? (
              <Box>
                <UserRoleBadge role={user.role} />
              </Box>
            ) : (
              <Text size="xs">{value}</Text>
            )}
          </SimpleGrid>
        ))}
      </Stack>
      {user.role === 'SUPER_ADMIN' && (
        <Text>บัญชีหลักของระบบ · ไม่สามารถลดสิทธิ์หรือปิดบัญชีได้</Text>
      )}
      {editable && (
        <>
          <Divider />
          <form
            id={formId}
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
                data={[
                  { value: 'ACTIVE', label: 'ใช้งานอยู่' },
                  { value: 'DISABLED', label: 'ปิดใช้งาน' },
                ]}
                value={status}
                onChange={(event) => setStatus(userStatusSchema.parse(event.currentTarget.value))}
                disabled={save.isPending}
              />
            </Stack>
          </form>
        </>
      )}
      <ErrorPopup error={save.error} />
      <Group justify="center" gap="sm">
        {editable && (
          <Button
            type="submit"
            form={formId}
            color="dark"
            loading={save.isPending}
            disabled={role === user.role && status === user.status}
          >
            บันทึกการเปลี่ยนแปลง
          </Button>
        )}
      </Group>
    </Stack>
  );
}
