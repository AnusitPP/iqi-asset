'use client';
import {
  Button,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  FORM_TEAMS,
  LOAN_TERMS,
  LOAN_NOTES,
  RETURN_TERMS,
} from '@shared/features/lending/formConstants.js';
import { catalogCategory } from '@shared/features/catalog/search.js';
import {
  loanFormSchema,
  returnFormSchema,
  lendingFormSchema,
  type CatalogRecord,
  type LendingSelection,
  type LendingFormValues,
} from '@/types/lending';
import { useAuthSession } from '@/features/auth/auth-provider';
import { loansService } from '@/services/loans.service';
import { returnsService } from '@/services/returns.service';
import { ErrorAlert } from '@/components/ui/feedback';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
import { useToast } from '@/providers/toast-provider';
import { LendingCatalogPicker } from './catalog-picker';
type FormValues = LendingFormValues;
const emptyValues: FormValues = {
  mode: 'loan',
  borrower: '',
  team: '',
  notes: '',
  purpose: '',
  start: '',
  due: '',
  date: '',
};
type FormSnapshot = { values: FormValues; selected: CatalogRecord | null; requestId: string };
export function LendingRequestForm({ mode }: { mode: 'loan' | 'return' }) {
  const { api } = useAuthSession(),
    client = useQueryClient(),
    { showToast } = useToast();
  const isSubmitCurrent = useSessionTaskGuard();
  const cacheKey = ['workspace-state', `${mode}-form`];
  const [initial] = useState(() => client.getQueryData<FormSnapshot>(cacheKey));
  const [selected, setSelected] = useState<CatalogRecord | null>(initial?.selected ?? null),
    [selectionError, setSelectionError] = useState(''),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(''),
    [pickerVersion, setPickerVersion] = useState(0);
  const requestId = useRef(initial?.requestId ?? crypto.randomUUID()),
    submitting = useRef(false);
  const form = useForm<FormValues>({
    mode: 'onBlur',
    defaultValues: initial?.values ?? { ...emptyValues, mode },
    resolver: zodResolver(lendingFormSchema),
  });
  const busy = form.formState.isSubmitting;
  useUnsavedChangesGuard(form.formState.isDirty || selected !== null || busy);
  useEffect(() => {
    const subscription = form.watch((_values, info) => {
      if (info.type === 'change') requestId.current = crypto.randomUUID();
      client.setQueryData(['workspace-state', `${mode}-form`], {
        values: form.getValues(),
        selected,
        requestId: requestId.current,
      });
    });
    return () => subscription.unsubscribe();
  }, [form, client, mode, selected]);
  useEffect(() => {
    client.setQueryData(['workspace-state', `${mode}-form`], {
      values: form.getValues(),
      selected,
      requestId: requestId.current,
    });
  }, [selected, client, mode, form]);
  const resetLendingRequestForm = () => {
    form.reset({ ...emptyValues, mode });
    setSelected(null);
    setSelectionError('');
    setError(null);
    setNotice('');
    requestId.current = crypto.randomUUID();
    setPickerVersion((value) => value + 1);
    client.removeQueries({ queryKey: ['workspace-state', `${mode}-form`], exact: true });
    client.removeQueries({ queryKey: ['workspace-state', `${mode}-catalog-query`], exact: true });
  };
  const handleSubmitLendingRequest = async (values: FormValues) => {
    if (submitting.current) return;
    if (!selected) {
      setSelectionError('กรุณาเลือกอุปกรณ์จากผลค้นหา');
      return;
    }
    const selection: LendingSelection = {
      requestId: requestId.current,
      category: catalogCategory(selected.name),
      selectedAsset: { asset: selected.asset, serial: selected.serial },
      identifier: [selected.asset, selected.serial].filter(Boolean).join(' / '),
    };
    submitting.current = true;
    setError(null);
    setNotice('');
    try {
      const result =
        mode === 'loan'
          ? await loansService.submitLoanRequest(api, {
              ...loanFormSchema.parse(values),
              ...selection,
            })
          : await returnsService.submitReturnRequest(api, {
              ...returnFormSchema.parse(values),
              ...selection,
            });
      if (!isSubmitCurrent()) return;
      resetLendingRequestForm();
      const message = `ส่ง${mode === 'loan' ? 'คำร้องยืม' : 'คำร้องคืน'}สำเร็จ · ${result.id} · รอเจ้าหน้าที่ดำเนินการ`;
      setNotice(message);
      showToast(message);
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
    } catch (caught) {
      setError(caught);
    } finally {
      submitting.current = false;
    }
  };
  return (
    <section>
      <div className="dash-heading">
        <h1>{mode === 'loan' ? 'ยืมครุภัณฑ์' : 'คืนครุภัณฑ์'}</h1>
      </div>
      <Paper withBorder radius="lg" p="lg">
        <form noValidate onSubmit={form.handleSubmit(handleSubmitLendingRequest)}>
          <Stack>
            <TextInput
              label="ชื่อ - สกุล"
              withAsterisk
              maxLength={200}
              {...form.register('borrower')}
              error={form.formState.errors.borrower?.message}
              disabled={busy}
            />
            <NativeSelect
              label="ทีม"
              withAsterisk
              data={[{ value: '', label: 'เลือก' }, ...FORM_TEAMS]}
              {...form.register('team')}
              error={form.formState.errors.team?.message}
              disabled={busy}
            />
            <Text fw={600}>
              {mode === 'loan'
                ? 'ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ'
                : 'ส่วนที่ 5 : คืนครุภัณฑ์คอมพิวเตอร์ หรือคืนวัสดุด้านเทคโนโลยีสารสนเทศ'}
            </Text>
            {(mode === 'loan' ? [LOAN_TERMS, ...LOAN_NOTES] : [RETURN_TERMS]).map((text) => (
              <Text size="sm" c="dimmed" key={text}>
                {text}
              </Text>
            ))}
            <LendingCatalogPicker
              mode={mode}
              key={pickerVersion}
              selected={selected}
              onSelect={(record) => {
                requestId.current = crypto.randomUUID();
                setSelected(record);
                setSelectionError('');
              }}
              disabled={busy}
              error={selectionError}
            />
            <TextInput
              label="เลขครุภัณฑ์, Serial Number (S/N), Service Tag"
              withAsterisk
              description="เติมอัตโนมัติเมื่อเลือกอุปกรณ์จากผลค้นหา"
              readOnly
              value={selected ? [selected.asset, selected.serial].filter(Boolean).join(' / ') : ''}
            />
            {mode === 'loan' ? (
              <>
                <Textarea
                  label="เหตุผล หรือวัตถุประสงค์"
                  withAsterisk
                  maxLength={500}
                  {...form.register('purpose')}
                  error={form.formState.errors.purpose?.message}
                  disabled={busy}
                />
                <Group grow>
                  <TextInput
                    label="วันที่ต้องการยืม"
                    withAsterisk
                    type="date"
                    {...form.register('start')}
                    error={form.formState.errors.start?.message}
                    disabled={busy}
                  />
                  <TextInput
                    label="กำหนดวันส่งคืน"
                    withAsterisk
                    type="date"
                    {...form.register('due')}
                    error={form.formState.errors.due?.message}
                    disabled={busy}
                  />
                </Group>
                <Text size="xs">สามารถยืมได้ไม่เกิน 7 วันตามปฏิทิน</Text>
              </>
            ) : (
              <TextInput
                label="วันที่ส่งคืน"
                withAsterisk
                type="date"
                {...form.register('date')}
                error={form.formState.errors.date?.message}
                disabled={busy}
              />
            )}
            <Textarea
              label="หมายเหตุ (ถ้ามี)"
              maxLength={2000}
              {...form.register('notes')}
              error={form.formState.errors.notes?.message}
              disabled={busy}
            />
            <ErrorAlert error={error} />
            <Text role="status">{notice}</Text>
            <Group>
              <Button type="submit" loading={busy}>
                ส่ง
              </Button>
              <Button variant="default" disabled={busy} onClick={resetLendingRequestForm}>
                ล้างแบบฟอร์ม
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </section>
  );
}
