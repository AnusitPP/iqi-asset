'use client';
import { TextInput } from '@mantine/core';
import { RETURN_TERMS } from '@shared/features/lending/formConstants.js';
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
  const { form, busy } = request;

  return (
    <LendingRequestForm
      request={request}
      title="คืนครุภัณฑ์"
      sectionTitle="ส่วนที่ 5 : คืนครุภัณฑ์คอมพิวเตอร์ หรือคืนวัสดุด้านเทคโนโลยีสารสนเทศ"
      terms={[RETURN_TERMS]}
    >
      <TextInput
        label="วันที่ส่งคืน"
        withAsterisk
        type="date"
        {...form.register('date')}
        error={form.formState.errors.date?.message}
        disabled={busy}
      />
    </LendingRequestForm>
  );
}
