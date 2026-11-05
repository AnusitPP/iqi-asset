'use client';
import { Button, Group, SimpleGrid, Stack, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Controller } from 'react-hook-form';
import { CalendarDays } from 'lucide-react';
import 'dayjs/locale/th';
import { LOAN_TERMS, LOAN_NOTES } from '@shared/features/lending/formConstants.js';
import { calendarDaysBetween } from '@shared/core/extensions/dates.js';
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
  const start = form.watch('start');
  const due = form.watch('due');
  const overSevenDays = !!start && !!due && calendarDaysBetween(start, due) > 7;

  return (
    <LendingRequestForm
      request={request}
      title="ยืมครุภัณฑ์"
      sectionTitle="ส่วนที่ 1 : ยืมครุภัณฑ์คอมพิวเตอร์ หรือยืมวัสดุด้านเทคโนโลยีสารสนเทศ"
      terms={[LOAN_TERMS, ...LOAN_NOTES]}
    >
      <Stack gap="xs">
        <Textarea
          label="เหตุผล หรือวัตถุประสงค์"
          withAsterisk
          maxLength={500}
          {...form.register('purpose')}
          error={form.formState.errors.purpose?.message}
          disabled={busy}
        />

        <Group gap="xs">
          {['ใช้ในสำนักงาน', 'ออกนอกสถานที่'].map((purpose) => (
            <Button
              key={purpose}
              type="button"
              size="xs"
              variant={form.watch('purpose') === purpose ? 'filled' : 'light'}
              disabled={busy}
              aria-pressed={form.watch('purpose') === purpose}
              onClick={() =>
                form.setValue('purpose', purpose, { shouldDirty: true, shouldValidate: true })
              }
            >
              {purpose}
            </Button>
          ))}
        </Group>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {(['start', 'due'] as const).map((name) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <DatePickerInput
                label={name === 'start' ? 'วันที่ต้องการยืม' : 'กำหนดวันส่งคืน'}
                description={name === 'due' && overSevenDays ? '*หมายเหตุ เกิน 7 วัน' : undefined}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                styles={{
                  description: {
                    color: 'var(--mantine-color-yellow-8)',
                    fontSize: 12,
                    marginTop: 4,
                  },
                }}
                withAsterisk
                placeholder="เลือกวันที่"
                locale="th"
                valueFormat="DD MMMM YYYY"
                firstDayOfWeek={0}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                ref={field.ref}
                error={name === 'start' ? fieldState.error?.message : undefined}
                disabled={busy}
                clearable
                leftSection={<CalendarDays size={16} aria-hidden="true" />}
                popoverProps={{ withinPortal: true, zIndex: 400, radius: 'lg', shadow: 'md' }}
                previousLabel="เดือนก่อนหน้า"
                nextLabel="เดือนถัดไป"
              />
            )}
          />
        ))}
      </SimpleGrid>
    </LendingRequestForm>
  );
}
