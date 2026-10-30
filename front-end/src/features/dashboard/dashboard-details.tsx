'use client';
import { useToast } from '@/providers/toast-provider';
import { Button, Modal, NativeSelect, Textarea, Stack, Text } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { useAuthSession } from '@/features/auth/auth-provider';
import { dashboardDetailFormSchema, type DashboardRecord } from '@/types/contracts';
import { dashboardService } from '@/services/dashboard.service';
import { ErrorAlert } from '@/components/ui/feedback';
import { AssetPhotoEditor } from '@/features/photos/photo-editor';
import { photoHeaders } from '@/features/photos/photo-utils';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
export function DashboardRecordDialog({
  record,
  headers,
  teams,
  onClose,
  onRefresh,
  onSaved,
}: {
  record: DashboardRecord;
  headers: string[];
  teams: string[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSaved: (record: DashboardRecord) => void;
}) {
  const { api } = useAuthSession();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false),
    [notice, setNotice] = useState('');
  const form = useForm<z.infer<typeof dashboardDetailFormSchema>>({
    resolver: zodResolver(dashboardDetailFormSchema),
    mode: 'onBlur',
    defaultValues: { team: record.team, notes: record.editableNotes },
  });
  const saveTeamAndNotesMutation = useMutation({
    mutationFn: (values: z.infer<typeof dashboardDetailFormSchema>) =>
      dashboardService.updateTeamAndNotes(api, record.row, {
        revision: record.revision,
        ...(values.team !== record.team ? { team: values.team } : {}),
        ...(values.notes !== record.editableNotes ? { notes: values.notes } : {}),
      }),
    onSuccess: (result) => {
      onSaved(result.record);
      form.reset({ team: result.record.team, notes: result.record.editableNotes });
      setNotice('บันทึกทีมและหมายเหตุแล้ว');
      showToast('บันทึกทีมและหมายเหตุแล้ว');
    },
  });
  const busy = uploading || saveTeamAndNotesMutation.isPending;
  useUnsavedChangesGuard(form.formState.isDirty || busy);
  const confirmAndCloseDashboardRecord = () => {
    if (busy) return;
    if (
      form.formState.isDirty &&
      !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดรายละเอียดหรือไม่?')
    )
      return;
    onClose();
  };
  return (
    <Modal
      opened
      onClose={confirmAndCloseDashboardRecord}
      title={record.asset}
      size="xl"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
    >
      <AssetPhotoEditor
        record={record}
        headers={headers}
        busy={busy || form.formState.isDirty}
        onBusy={setUploading}
        onRefresh={onRefresh}
      />
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await saveTeamAndNotesMutation.mutateAsync(values).catch(() => {});
        })}
      >
        <Stack>
          <ErrorAlert error={saveTeamAndNotesMutation.error} />
          <Text role="status">{notice}</Text>
          <div className="fields">
            {headers.map((header, i) =>
              photoHeaders.includes(header) || header === 'รูปครุภัณฑ์' ? null : (
                <div className="field" key={i}>
                  {header === 'ทีม' ? (
                    <NativeSelect
                      label="ทีม"
                      data={[
                        { value: '', label: 'ไม่ระบุทีม' },
                        ...[...new Set([record.team, ...teams])]
                          .filter(Boolean)
                          .map((value) => ({ value, label: value })),
                      ]}
                      {...form.register('team')}
                      disabled={busy}
                    />
                  ) : header === 'หมายเหตุ' ? (
                    <Textarea
                      label="หมายเหตุ"
                      rows={3}
                      maxLength={5000}
                      {...form.register('notes')}
                      error={form.formState.errors.notes?.message}
                      disabled={busy}
                    />
                  ) : (
                    <>
                      <div className="field-label">{header}</div>
                      <div className="field-value">{record.values[i] || '—'}</div>
                    </>
                  )}
                </div>
              ),
            )}
          </div>
          <Button
            type="submit"
            loading={saveTeamAndNotesMutation.isPending}
            disabled={!form.formState.isDirty || uploading}
          >
            บันทึกทีมและหมายเหตุ
          </Button>
          <Button variant="default" disabled={busy} onClick={confirmAndCloseDashboardRecord}>
            ปิด
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
