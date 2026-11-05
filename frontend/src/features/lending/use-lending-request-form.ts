'use client';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { catalogCategory } from '@shared/features/catalog/search.js';
import {
  lendingFormSchema,
  type CatalogRecord,
  type LendingSelection,
  type LendingFormValues,
} from '@/types/lending';
import type { ApiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useSessionTaskGuard } from '@/hooks/use-session-task-guard';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved';
import { useToast } from '@/providers/toast-provider';
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
export type SubmitLendingRequest = (
  api: ApiClient,
  values: LendingFormValues,
  selection: LendingSelection,
) => Promise<{ id: string; mailNotification?: 'sent' | 'failed' }>;

type LendingRequestOptions = {
  mode: 'loan' | 'return';
  requestName: string;
  submitRequest: SubmitLendingRequest;
};

export function useLendingRequestForm({ mode, requestName, submitRequest }: LendingRequestOptions) {
  const { api, user } = useAuthSession(),
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
    defaultValues: {
      ...(initial?.values ?? { ...emptyValues, mode }),
      borrower: user?.name ?? initial?.values.borrower ?? '',
    },
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
  const resetLendingRequestForm = (keepSelection = false) => {
    form.reset({ ...emptyValues, mode, borrower: user?.name ?? '' });
    if (!keepSelection) setSelected(null);
    setSelectionError('');
    setError(null);
    setNotice('');
    requestId.current = crypto.randomUUID();
    if (!keepSelection) setPickerVersion((value) => value + 1);
    client.removeQueries({ queryKey: ['workspace-state', `${mode}-form`], exact: true });
    if (keepSelection)
      client.setQueryData(['workspace-state', `${mode}-form`], {
        values: form.getValues(),
        selected,
        requestId: requestId.current,
      });
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
      const result = await submitRequest(api, values, selection);
      if (!isSubmitCurrent()) return;
      resetLendingRequestForm();
      const mailNotice =
        result.mailNotification === 'sent'
          ? ' · ส่งอีเมลยืนยันแล้ว'
          : result.mailNotification === 'failed'
            ? ' · บันทึกคำขอแล้ว แต่ส่งอีเมลไม่สำเร็จ ไม่ต้องส่งคำขอซ้ำ'
            : '';
      const message = `ส่ง${requestName}สำเร็จ · ${result.id} · รอเจ้าหน้าที่ดำเนินการ${mailNotice}`;
      setNotice(message);
      showToast(message);
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      await client.invalidateQueries({ queryKey: ['return-catalog'] });
      await client.invalidateQueries({ queryKey: ['my-requests'] });
    } catch (caught) {
      setError(caught);
      if (caught instanceof ApiError && caught.status === 409) {
        await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      }
    } finally {
      submitting.current = false;
    }
  };
  const selectLendingAsset = (record: CatalogRecord | null) => {
    if (mode === 'loan' && record && !form.getValues('start')) {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      form.setValue('start', today, { shouldDirty: true });
    }
    requestId.current = crypto.randomUUID();
    setSelected(record);
    setSelectionError('');
  };
  return {
    mode,
    borrowerReadOnly: !!user,
    form,
    busy,
    selected,
    selectionError,
    error,
    notice,
    pickerVersion,
    selectLendingAsset,
    resetLendingRequestForm,
    handleSubmitLendingRequest,
  };
}

export type LendingRequestController = ReturnType<typeof useLendingRequestForm>;
