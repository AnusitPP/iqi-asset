'use client';
import { useToast } from '@/providers/toast-provider';
import { Button, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthSession } from '@/features/auth/auth-provider';
import { detailFormSchema, type AssetRecord } from '@/types/contracts';
import { assetsService } from '@/services/assets.service';
import {
  formatAssetFieldValue,
  preserveUnchangedAssetValues,
  formatBangkokDateInBuddhistEra,
  updateInspectionDateInNote,
} from '@/lib/display';
import { ErrorAlert, LoadingIndicator } from '@/components/ui/feedback';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';

export function AssetRecordDialog({
  target,
  onClose,
}: {
  target: { sheet: string; row: number };
  onClose: () => void;
}) {
  const { api } = useAuthSession();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const record = useQuery({
    queryKey: ['record', target.sheet, target.row],
    queryFn: ({ signal }) => assetsService.fetchAssetRecord(api, target, signal),
    staleTime: 0,
  });
  return (
    <Modal
      opened
      onClose={onClose}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title="รายละเอียดครุภัณฑ์"
      size="xl"
    >
      {saved && <Text role="status">บันทึกสำเร็จ · อ่านข้อมูลล่าสุดจาก Google Sheets แล้ว</Text>}
      {record.isPending ? (
        <>
          <LoadingIndicator />
          <Button onClick={onClose}>ปิดรายละเอียด</Button>
        </>
      ) : record.data ? (
        <AssetRecordEditor
          key={record.data.revision ?? `${target.sheet}-${target.row}`}
          record={record.data}
          onClose={onClose}
          onSaved={() => {
            setSaved(true);
            showToast('บันทึกสำเร็จ · อ่านข้อมูลล่าสุดจาก Google Sheets แล้ว');
          }}
        />
      ) : (
        <>
          <ErrorAlert error={record.error} />
          <Button onClick={onClose}>ปิดรายละเอียด</Button>
          <Button
            onClick={() => {
              void record.refetch();
            }}
          >
            ลองอีกครั้ง
          </Button>
        </>
      )}
    </Modal>
  );
}
function AssetRecordEditor({
  record,
  onClose,
  onSaved,
}: {
  record: AssetRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useAuthSession(),
    client = useQueryClient();
  const [editing, setEditing] = useState(false),
    [hint, setHint] = useState('');
  const baseline = record.values.map((v) => v.replace(/\r\n?/g, '\n'));
  const form = useForm<z.infer<typeof detailFormSchema>>({
    resolver: zodResolver(detailFormSchema),
    mode: 'onBlur',
    defaultValues: { values: baseline },
  });
  useUnsavedChangesGuard(form.formState.isDirty || form.formState.isSubmitting);
  const saveAssetRecordMutation = useMutation({
    mutationFn: (values: string[]) =>
      assetsService.updateAssetRecord(api, record.row, {
        sheet: record.sheet,
        revision: record.revision,
        values: preserveUnchangedAssetValues(record.values, baseline, values),
      }),
    onSuccess: async (fresh) => {
      form.reset({ values: fresh.values.map((v) => v.replace(/\r\n?/g, '\n')) });
      client.setQueryData(['record', record.sheet, record.row], fresh);
      setEditing(false);
      onSaved();
      await client.invalidateQueries({ queryKey: ['search'] });
    },
  });
  const confirmAndCloseAssetRecord = () => {
    if (saveAssetRecordMutation.isPending || form.formState.isSubmitting) return;
    if (
      form.formState.isDirty &&
      !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดรายละเอียดหรือไม่?')
    )
      return;
    onClose();
  };
  return (
    <form
      onSubmit={form.handleSubmit(async ({ values }) => {
        await saveAssetRecordMutation.mutateAsync(values).catch(() => {});
      })}
    >
      <Stack>
        <Text fw={700}>
          {record.values[record.assetIndex] || 'รายละเอียดครุภัณฑ์'} · {record.label} / แถว{' '}
          {record.row}
        </Text>
        <Text>
          {record.editable ? 'แก้ไขได้' : 'ดูอย่างเดียว'} · ข้อมูลครบ {record.headers.length}{' '}
          คอลัมน์
        </Text>
        <ErrorAlert error={saveAssetRecordMutation.error} />
        {hint && <Text role="status">{hint}</Text>}
        {editing &&
          (record.dateIndex !== null ? (
            <Button
              variant="light"
              disabled={saveAssetRecordMutation.isPending}
              onClick={() => {
                const index = record.dateIndex;
                if (index === null) return;
                const value = form.getValues(`values.${index}`) ?? '';
                const next =
                  record.dateMode === 'inspection-note'
                    ? updateInspectionDateInNote(value, formatBangkokDateInBuddhistEra())
                    : formatBangkokDateInBuddhistEra();
                const rule = record.dropdowns[index];
                if (rule?.strict && !rule.options.includes(next)) {
                  setHint('ช่องวันที่จำกัดตัวเลือกใน Google Sheets จึงตั้งวันที่ไม่ได้');
                  return;
                }
                form.setValue(`values.${index}`, next, { shouldDirty: true, shouldValidate: true });
                setHint('ตั้งวันที่ในฟอร์มแล้ว กดบันทึกเพื่ออัปเดต Google Sheets');
              }}
            >
              ตั้งวันที่เป็นวันนี้
            </Button>
          ) : (
            <Text>ไม่พบคอลัมน์วันที่ตรวจสอบที่ชัดเจน</Text>
          ))}
        <div className={`fields ${editing ? 'editing' : ''}`}>
          {record.headers.map((header, index) => {
            const rule = record.dropdowns[index],
              value = record.values[index] ?? '',
              label = header || `คอลัมน์ ${index + 1} (ไม่มีชื่อ header)`;
            return (
              <div className="field" key={index}>
                {!editing ? (
                  <>
                    <div className="field-label">{label}</div>
                    <div className="field-value">{formatAssetFieldValue(header, value) || '-'}</div>
                  </>
                ) : rule?.strict ? (
                  <Select
                    label={label}
                    data={[
                      { value: '', label: '— ไม่ระบุ —' },
                      ...[
                        ...new Set([
                          ...(value && !rule.options.includes(value) ? [value] : []),
                          ...rule.options,
                        ]),
                      ]
                        .filter(Boolean)
                        .map((v) => ({ value: v, label: formatAssetFieldValue(header, v) })),
                    ]}
                    value={form.watch(`values.${index}`)}
                    onChange={(v) =>
                      form.setValue(`values.${index}`, v ?? '', {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    disabled={saveAssetRecordMutation.isPending}
                    error={form.formState.errors.values?.[index]?.message}
                  />
                ) : rule ? (
                  <>
                    <TextInput
                      label={label}
                      list={`choices-${index}`}
                      {...form.register(`values.${index}`)}
                      disabled={saveAssetRecordMutation.isPending}
                      error={form.formState.errors.values?.[index]?.message}
                    />
                    <datalist id={`choices-${index}`}>
                      {rule.options.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <Textarea
                    label={label}
                    autosize
                    minRows={
                      /รายละเอียด|หมายเหตุ|ประวัติ/.test(header) || value.length > 70 ? 3 : 1
                    }
                    {...form.register(`values.${index}`)}
                    disabled={saveAssetRecordMutation.isPending}
                    error={form.formState.errors.values?.[index]?.message}
                  />
                )}
                {editing && rule && (
                  <Text size="xs">
                    {rule.strict
                      ? 'ตัวเลือกตาม Google Sheets'
                      : 'เลือกจาก Google Sheets หรือกรอกค่าอื่นได้ตามกฎในชีต'}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
        <Group justify="flex-end">
          <Button
            variant="default"
            disabled={saveAssetRecordMutation.isPending}
            onClick={confirmAndCloseAssetRecord}
          >
            ปิดรายละเอียด
          </Button>
          {record.editable &&
            (!editing ? (
              <Button onClick={() => setEditing(true)}>แก้ไขข้อมูล</Button>
            ) : (
              <>
                <Button
                  variant="default"
                  disabled={saveAssetRecordMutation.isPending}
                  onClick={() => {
                    if (form.formState.isDirty && !window.confirm('ยกเลิกข้อมูลที่แก้ไขทั้งหมด?'))
                      return;
                    form.reset();
                    setEditing(false);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  loading={saveAssetRecordMutation.isPending}
                  disabled={!form.formState.isDirty}
                >
                  บันทึก
                </Button>
              </>
            ))}
        </Group>
      </Stack>
    </form>
  );
}
