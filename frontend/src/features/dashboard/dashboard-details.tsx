'use client';
import { useToast } from '@/providers/toast-provider';
import {
  Button,
  Group,
  Modal,
  NativeSelect,
  Textarea,
  Stack,
  Text,
  SimpleGrid,
  Box,
} from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { useAuthSession } from '@/features/auth/auth-provider';
import { type DashboardRecord } from '@/types/contracts';
import { dashboardService } from '@/services/dashboard.service';
import { ErrorPopup } from '@/components/core/error-popup';
import { AssetPhotoEditor } from '@/features/photos/photo-editor';
import { editableDashboardHeaders } from '@shared/features/records/dashboardFields.js';
import { photoHeaders } from '@/features/photos/photo-utils';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
export function DashboardRecordDialog({
  record,
  headers,
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
  const dashboardDetailFormSchema = z.object({
    fields: z.record(z.string(), z.string().max(5000)),
  });
  const initialFields = Object.fromEntries(
    headers
      .filter((h) => editableDashboardHeaders.includes(h))
      .map((h) => [h, record.values[headers.indexOf(h)] || '']),
  );
  initialFields['ทีม'] = record.team;
  const form = useForm<z.infer<typeof dashboardDetailFormSchema>>({
    resolver: zodResolver(dashboardDetailFormSchema),
    mode: 'onBlur',
    defaultValues: { fields: initialFields },
  });
  const saveTeamAndNotesMutation = useMutation({
    mutationFn: (values: z.infer<typeof dashboardDetailFormSchema>) =>
      dashboardService.updateTeamAndNotes(api, record.row, {
        revision: record.revision,
        fields: values.fields,
      }),
    onSuccess: (result) => {
      onSaved(result.record);
      form.reset({
        fields: Object.fromEntries(
          headers
            .filter((h) => editableDashboardHeaders.includes(h))
            .map((h) => [h, result.record.values[headers.indexOf(h)] || '']),
        ),
      });
      setNotice('บันทึกข้อมูลแล้ว');
      showToast('บันทึกข้อมูลแล้ว');
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
          <ErrorPopup error={saveTeamAndNotesMutation.error} />
          <Text role="status">{notice}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="fields">
            {headers.map((header, i) =>
              photoHeaders.includes(header) || header === 'รูปครุภัณฑ์' ? null : (
                <Stack gap={0} className="field" key={i}>
                  {header === 'ทีม' ? (
                    <NativeSelect
                      label="ทีม"
                      data={[
                        { value: '', label: 'ไม่ระบุทีม' },
                        ...[record.team].filter(Boolean).map((value) => ({ value, label: value })),
                      ]}
                      {...form.register('fields.ทีม')}
                      disabled={busy}
                      styles={{
                        input: { backgroundColor: '#fefefe' },
                      }}
                    />
                  ) : editableDashboardHeaders.includes(header) ? (
                    <Textarea
                      label={header}
                      rows={2}
                      maxLength={5000}
                      {...form.register(`fields.${header}`)}
                      disabled={busy}
                      styles={{
                        input: { backgroundColor: '#fefefe' },
                      }}
                      error={form.formState.errors.fields?.[header]?.message}
                    />
                  ) : (
                    <>
                      <Box className="field-label">{header}</Box>
                      <Box className="field-value">{record.values[i] || '—'}</Box>
                    </>
                  )}
                </Stack>
              ),
            )}
          </SimpleGrid>
          <Group justify="center" gap="md">
            <Button
              type="submit"
              loading={saveTeamAndNotesMutation.isPending}
              disabled={!form.formState.isDirty || uploading}
            >
              บันทึกทีมและหมายเหตุ
            </Button>
            <Button
              color="red"
              variant="filled"
              disabled={busy}
              onClick={confirmAndCloseDashboardRecord}
            >
              ยกเลิก
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
