'use client';
import { Button, Modal, NativeSelect, Stack, Text } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { inspectionFormSchema, reviewStatuses, type ReviewTarget } from '@/types/contracts';
import { inspectionsService } from '@/services/inspections.service';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
export function ReviewInspectionDialog({
  target,
  onClose,
  onSaved,
}: {
  target: ReviewTarget;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { api } = useAuthSession(),
    client = useQueryClient();
  const current = useQuery({
    queryKey: ['inspection', target.sheet, target.row, target.revision],
    queryFn: ({ signal }) => inspectionsService.fetchReviewInspection(api, target, signal),
    staleTime: 0,
  });
  const form = useForm<z.infer<typeof inspectionFormSchema>>({
    resolver: zodResolver(inspectionFormSchema),
    mode: 'onBlur',
    values: { status: current.data?.status ?? '' },
  });
  const saveReviewInspectionMutation = useMutation({
    mutationFn: (body: z.infer<typeof inspectionFormSchema>) =>
      inspectionsService.updateReviewInspection(api, {
        sheet: target.sheet,
        row: target.row,
        revision: target.revision,
        ...body,
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['search'] });
      onSaved(
        result.unchanged
          ? 'สถานะเหมือนเดิม วันที่ไม่เปลี่ยน'
          : 'บันทึกสถานะและวันที่ตรวจเรียบร้อยแล้ว',
      );
      onClose();
    },
  });
  return (
    <Modal
      opened
      onClose={() => {
        if (!saveReviewInspectionMutation.isPending) onClose();
      }}
      closeOnClickOutside={!saveReviewInspectionMutation.isPending}
      closeOnEscape={!saveReviewInspectionMutation.isPending}
      title="บันทึกผลตรวจ"
    >
      <form
        id="inspection-form"
        data-status={form.watch('status')}
        onSubmit={form.handleSubmit(async (values) => {
          await saveReviewInspectionMutation.mutateAsync(values).catch(() => {});
        })}
      >
        <Stack>
          <Text>{target.asset}</Text>
          {current.isPending && <LoadingIndicator />}
          <ErrorAlert error={current.error} />
          <ErrorAlert error={saveReviewInspectionMutation.error} />
          {current.error && (
            <Button
              onClick={() => {
                void current.refetch();
              }}
            >
              ลองอีกครั้ง
            </Button>
          )}
          <NativeSelect
            id="inspection-status"
            label="สถานะการตรวจสอบ"
            data={[
              { value: '', label: 'เลือกสถานะ' },
              ...reviewStatuses.map((value) => ({ value, label: value })),
            ]}
            {...form.register('status')}
            error={form.formState.errors.status?.message}
            disabled={!current.data || saveReviewInspectionMutation.isPending}
          />
          <Text>
            {current.data?.date
              ? `แก้ไขล่าสุด: ${current.data.date}`
              : 'วันที่จะลงอัตโนมัติเมื่อบันทึกผลตรวจ'}
          </Text>
          <Button
            type="submit"
            disabled={!current.data}
            loading={saveReviewInspectionMutation.isPending}
          >
            บันทึกผลตรวจ
          </Button>
          <Button
            variant="default"
            disabled={saveReviewInspectionMutation.isPending}
            onClick={onClose}
          >
            ยกเลิก
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
