'use client';
import { useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { ErrorPopup } from '@/components/core/error-popup';
import { useToast } from '@/providers/toast-provider';

export function CancelLoanRequest({ id, onCancelled }: { id: string; onCancelled: () => void }) {
  const [opened, setOpened] = useState(false);
  const { api } = useAuthSession();
  const client = useQueryClient();
  const { showToast } = useToast();
  const cancel = useMutation({
    mutationFn: () =>
      api.request(
        `/api/my-requests/${encodeURIComponent(id)}/cancel`,
        z.object({ id: z.string() }),
        { method: 'POST' },
      ),
    onSuccess: async () => {
      setOpened(false);
      onCancelled();
      showToast(`ยกเลิกคำขอยืม ${id} แล้ว`);
      await Promise.all(
        ['my-requests', 'approval-requests', 'loan-catalog', 'return-catalog'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  return (
    <>
      <Button
        color="red"
        variant="light"
        onClick={() => {
          cancel.reset();
          setOpened(true);
        }}
      >
        ยกเลิกคำขอยืม
      </Button>
      <Modal
        opened={opened}
        onClose={() => {
          if (!cancel.isPending) setOpened(false);
        }}
        title="ยืนยันการยกเลิกคำขอยืม"
        centered
        size="sm"
        closeOnClickOutside={!cancel.isPending}
        closeOnEscape={!cancel.isPending}
        withCloseButton={!cancel.isPending}
      >
        <Stack>
          <Text>ต้องการยกเลิกคำขอยืม {id} ใช่ไหม?</Text>
          <Text size="sm" c="dimmed">
            คำขอจะเปลี่ยนเป็นสถานะยกเลิก โดยยังเก็บประวัติไว้ในระบบ
          </Text>
          <ErrorPopup
            error={cancel.error}
            onRefresh={async () => {
              await client.invalidateQueries({ queryKey: ['my-requests'] });
              cancel.reset();
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" disabled={cancel.isPending} onClick={() => setOpened(false)}>
              กลับ
            </Button>
            <Button color="red" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              ยืนยันยกเลิกคำขอ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
