import { z } from 'zod';
import { FORM_TEAMS } from '@shared/features/lending/formConstants.js';
import { MAX_LOAN_DAYS } from '@shared/features/lending/status.js';
import { calendarDaysBetween, isIsoCalendarDate } from '@shared/core/extensions/dates.js';

export const catalogRecordSchema = z.object({
  row: z.number().int(),
  asset: z.string().min(1),
  serial: z.string(),
  name: z.string(),
});
export const catalogSchema = z.object({ records: z.array(catalogRecordSchema) });
export type CatalogRecord = z.infer<typeof catalogRecordSchema>;
export const lendingResultSchema = z.object({
  id: z.string().min(1),
  unchanged: z.boolean().optional(),
});
const requiredText = (maximum: number) =>
  z.string().trim().min(1, 'กรุณากรอกข้อมูล').max(maximum, `กรอกได้ไม่เกิน ${maximum} ตัวอักษร`);
const calendarDate = z.string().refine(isIsoCalendarDate, 'กรุณาระบุวันที่ให้ถูกต้อง');
const commonFields = {
  borrower: requiredText(200),
  team: z.string().refine((value) => FORM_TEAMS.includes(value), 'กรุณาเลือกทีมจากรายการ'),
  notes: z.string().max(2000, 'หมายเหตุยาวเกิน 2000 ตัวอักษร'),
};
export const loanFormSchema = z
  .object({ ...commonFields, purpose: requiredText(500), start: calendarDate, due: calendarDate })
  .superRefine((values, context) => {
    if (
      isIsoCalendarDate(values.start) &&
      isIsoCalendarDate(values.due) &&
      (values.due < values.start || calendarDaysBetween(values.start, values.due) > MAX_LOAN_DAYS)
    )
      context.addIssue({
        code: 'custom',
        path: ['due'],
        message: 'กำหนดคืนต้องไม่ก่อนวันที่ยืมและไม่เกิน 7 วัน',
      });
  });
export const returnFormSchema = z.object({ ...commonFields, date: calendarDate });
export type LoanFormValues = z.infer<typeof loanFormSchema>;
export type ReturnFormValues = z.infer<typeof returnFormSchema>;
export type LendingSelection = {
  requestId: string;
  category: string;
  selectedAsset: { asset: string; serial: string };
  identifier: string;
};
export type LoanRequestInput = LoanFormValues & LendingSelection;
export type ReturnRequestInput = ReturnFormValues & LendingSelection;

export const lendingFormSchema = z
  .object({
    mode: z.enum(['loan', 'return']),
    ...commonFields,
    purpose: z.string(),
    start: z.string(),
    due: z.string(),
    date: z.string(),
  })
  .superRefine((values, context) => {
    const result =
      values.mode === 'loan'
        ? loanFormSchema.safeParse(values)
        : returnFormSchema.safeParse(values);
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  });
export type LendingFormValues = z.infer<typeof lendingFormSchema>;
