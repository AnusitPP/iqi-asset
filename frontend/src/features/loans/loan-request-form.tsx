'use client';
import { Group, Text, Textarea, TextInput } from '@mantine/core';
import { LOAN_TERMS, LOAN_NOTES } from '@shared/features/lending/formConstants.js';
import { loanFormSchema } from '@/types/lending';
import { loansService } from '@/services/loans.service';
import { LendingRequestForm } from '@/features/lending/lending-request-form';
import {
  useLendingRequestForm,
  type SubmitLendingRequest,
} from '@/features/lending/use-lending-request-form';

const submitLoanRequest: SubmitLendingRequest = (api, values, selection) =>
  loansService.submitLoanRequest(api, { ...loanFormSchema.parse(values), ...selection });

export function LoanRequestForm() {
  const request = useLendingRequestForm({
    mode: 'loan',
    requestName: 'คำร้องยืม',
    submitRequest: submitLoanRequest,
  });
  const { form, busy } = request;

  return (
    <LendingRequestForm
      request={request}
      title="ยืมครุภัณฑ์"
      sectionTitle="ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ"
      terms={[LOAN_TERMS, ...LOAN_NOTES]}
    >
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
    </LendingRequestForm>
  );
}
