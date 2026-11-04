'use client';
import { useQuery, useIsMutating } from '@tanstack/react-query';
import { Button, Group, Modal } from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { usersService } from '@/services/users.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { UserAccessEditor } from './user-access-editor';

export function UserDetailsDialog({
  id,
  editing,
  onClose,
}: {
  id: string;
  editing: boolean;
  onClose: () => void;
}) {
  const { api } = useAuthSession();
  const saving = useIsMutating({ mutationKey: ['user-access', id] }) > 0;
  const detail = useQuery({
    queryKey: ['user', id],
    queryFn: ({ signal }) => usersService.detail(api, id, signal),
    staleTime: 0,
  });
  return (
    <Modal
      opened
      onClose={onClose}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'ปิดหน้าต่าง', disabled: saving }}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={editing ? 'จัดการสิทธิ์ผู้ใช้งาน' : 'ข้อมูลผู้ใช้งาน'}
      size={560}
      radius="lg"
      padding="lg"
      centered
      styles={{ title: { fontSize: 16, fontWeight: 700 }, header: { paddingBottom: 24 } }}
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
        <Group justify="center" mt="md">
          <Button variant="default" onClick={onClose}>
            ปิด
          </Button>
        </Group>
      )}
    </Modal>
  );
}
