'use client';
import { bangkokIsoDate } from '@shared/core/extensions/dates.js';
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
import { catalogService } from '@/services/catalog.service';
import dayjs from 'dayjs';
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
  serviceMode: false,
  email: '',
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
  const canProvideService =
    mode === 'loan' && !!user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const [selected, setSelected] = useState<CatalogRecord | null>(initial?.selected ?? null),
    [selectionError, setSelectionError] = useState(''),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(''),
    [pickerVersion, setPickerVersion] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const requestId = useRef(initial?.requestId ?? crypto.randomUUID()),
    submitting = useRef(false);
  const form = useForm<FormValues>({
    mode: 'onBlur',
    defaultValues: {
      ...(initial?.values ?? { ...emptyValues, mode }),
      borrower:
        canProvideService && initial?.values.serviceMode
          ? initial.values.borrower
          : (user?.name ?? ''),
      email:
        canProvideService && initial?.values.serviceMode
          ? initial.values.email
          : (user?.email ?? ''),
      serviceMode: canProvideService && initial?.values.serviceMode === true,
    },
    resolver: zodResolver(lendingFormSchema),
  });
  const busy = form.formState.isSubmitting || deleting;
  const serviceMode = canProvideService && form.watch('serviceMode') === true;
  const setServiceMode = (enabled: boolean) => {
    if (!canProvideService) return;
    requestId.current = crypto.randomUUID();
    form.setValue('serviceMode', enabled, { shouldDirty: true, shouldValidate: true });
    if (!enabled) {
      form.setValue('borrower', user?.name ?? '', { shouldDirty: true, shouldValidate: true });
      form.setValue('email', user?.email ?? '', { shouldDirty: true, shouldValidate: true });
    }
  };
  useUnsavedChangesGuard(Object.keys(form.formState.dirtyFields).length > 0 || busy);
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
    form.reset({ ...emptyValues, mode, borrower: user?.name ?? '', email: user?.email ?? '' });
    if (!keepSelection) setSelected(null);
    setSelectionError('');
    setError(null);
    setDeleteError(null);
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
  const deleteLendingAsset = async () => {
    if (!canProvideService || !selected || submitting.current) return false;
    submitting.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await catalogService.remove(api, selected);
      if (!isSubmitCurrent()) return false;
      resetLendingRequestForm();
      const message = result.photosPending
        ? `ลบรายการจาก Sheet แล้ว แต่ยังย้ายรูป ${result.photosPending} รูปไปถังขยะ Drive ไม่สำเร็จ กรุณาตรวจสอบใน Drive`
        : 'ลบรายการเรียบร้อยแล้ว';
      setNotice(message);
      showToast(message);
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      await client.invalidateQueries({ queryKey: ['return-catalog'] });
      return true;
    } catch (caught) {
      setDeleteError(caught);
      await client.invalidateQueries({ queryKey: ['loan-catalog'] });
      return false;
    } finally {
      submitting.current = false;
      setDeleting(false);
    }
  };
  const handleSubmitLendingRequest = async (values: FormValues) => {
    if (submitting.current) return;
    if (!selected) {
      setSelectionError('กรุณาเลือกอุปกรณ์จากผลค้นหา');
      return;
    }
    const selection: LendingSelection = {
      requestId: requestId.current,
      category: selected.category || catalogCategory(selected.name),
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
    setNotice('');
    setError(null);
    setDeleteError(null);
    if (record && mode === 'return') {
      const today = bangkokIsoDate();
      form.setValue('date', today, { shouldDirty: false });
      form.setValue('team', record.team ?? '', { shouldDirty: false });
    } else if (record && mode === 'loan') {
      const start = form.getValues('start') || bangkokIsoDate();
      const due = form.getValues('due') || dayjs(start).add(7, 'day').format('YYYY-MM-DD');
      if (!form.getValues('start')) form.setValue('start', start, { shouldDirty: false });
      if (!form.getValues('due')) form.setValue('due', due, { shouldDirty: false });
    }
    requestId.current = crypto.randomUUID();
    setSelected(record);
    setSelectionError('');
  };
  return {
    mode,
    borrowerReadOnly: !!user && !serviceMode,
    canProvideService,
    canDeleteCatalogItem: canProvideService,
    deleting,
    deleteError,
    deleteLendingAsset,
    serviceMode,
    setServiceMode,
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
