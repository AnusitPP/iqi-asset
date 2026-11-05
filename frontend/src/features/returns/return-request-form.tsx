'use client';
import { TextInput } from '@mantine/core';
import { returnFormSchema } from '@/types/lending';
import { returnsService } from '@/services/returns.service';
import { LendingRequestForm } from '@/features/lending/lending-request-form';
import {
  useLendingRequestForm,
  type SubmitLendingRequest,
} from '@/features/lending/use-lending-request-form';

const submitReturnRequest: SubmitLendingRequest = (api, values, selection) =>
  returnsService.submitReturnRequest(api, { ...returnFormSchema.parse(values), ...selection });

export function ReturnRequestForm() {
  const request = useLendingRequestForm({
    mode: 'return',
    requestName: 'คำร้องคืน',
    submitRequest: submitReturnRequest,
  });
  const { form } = request;

  return (
    <LendingRequestForm request={request} title="คืนครุภัณฑ์" sectionTitle="" terms={[]}>
      <TextInput
        label="วันที่ส่งคืน"
        withAsterisk
        type="date"
        readOnly
        value={form.watch('date')}
        error={form.formState.errors.date?.message}
        disabled
      />
    </LendingRequestForm>
  );
}
