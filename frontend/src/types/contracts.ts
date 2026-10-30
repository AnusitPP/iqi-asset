import { z } from 'zod';

export const sessionSchema = z.object({ authenticated: z.boolean(), csrf: z.string().min(1) });
export const authResultSchema = z.object({ authenticated: z.boolean() });
const safeLink = z
  .string()
  .url()
  .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol));
export const statusSchema = z.object({
  connected: z.boolean(),
  csrf: z.string(),
  sheets: z.array(z.string()),
  reviewUrl: safeLink.nullable(),
  iqiItUrl: safeLink.nullable(),
});
export const uploadConfigSchema = z.object({ maxUploadBytes: z.number().positive() });
export const reviewStatuses = ['ดี', 'ชำรุด', 'หาไม่เจอ'] as const;
export const dashboardStatuses = [
  ...reviewStatuses,
  'ยังไม่ตรวจ',
  'อุปกรอื่นๆ',
  'กล้องวงจรปิด',
] as const;
export const inspectionFormSchema = z.object({
  status: z
    .string()
    .refine(
      (value) => reviewStatuses.some((status) => status === value),
      'กรุณาเลือกสถานะการตรวจสอบ',
    ),
});
export const inspectionSchema = z.object({
  status: z.string(),
  date: z.string(),
  unchanged: z.boolean().optional(),
});
export const searchRecordSchema = z.object({
  row: z.number().int(),
  sourceSheet: z.string(),
  asset: z.string(),
  name: z.string(),
  brand: z.string(),
  owner: z.string(),
  initials: z.string(),
  nickname: z.string(),
  team: z.string(),
  inspectionDate: z.string(),
  pending: z.boolean(),
  reviewSheet: z.string(),
  inspected: z.boolean(),
  inspectionStatus: z.string(),
  revision: z.string(),
});
export const searchSchema = z.object({
  query: z.string(),
  pendingOnly: z.boolean(),
  groups: z.array(
    z.object({
      sheet: z.string(),
      label: z.string(),
      editable: z.boolean(),
      count: z.number(),
      matchType: z.string(),
      reviewGroup: z.boolean().optional(),
      records: z.array(searchRecordSchema),
    }),
  ),
});
export const recordSchema = z
  .object({
    sheet: z.string(),
    label: z.string(),
    row: z.number().int(),
    headers: z.array(z.string()),
    values: z.array(z.string()),
    assetIndex: z.number().int().nonnegative(),
    editable: z.boolean(),
    revision: z.string().nullable(),
    dropdowns: z.array(z.object({ options: z.array(z.string()), strict: z.boolean() }).nullable()),
    dateIndex: z.number().int().nonnegative().nullable(),
    dateMode: z.string(),
    today: z.string(),
  })
  .refine(
    (r) =>
      r.values.length === r.headers.length &&
      r.assetIndex < r.headers.length &&
      (r.dateIndex === null || r.dateIndex < r.headers.length),
    'จำนวนคอลัมน์ไม่ตรงกัน',
  );
export const selectionSchema = z.object({
  pending: z.boolean(),
  revision: z.string(),
  reviewSheet: z.string().optional(),
});
export const dashboardRecordSchema = z.object({
  row: z.number().int(),
  revision: z.string(),
  updatedAt: z.string(),
  asset: z.string(),
  name: z.string(),
  serial: z.string(),
  inspection: z.enum([...dashboardStatuses, 'ไม่ระบุ']),
  comparison: z.string(),
  owner: z.string(),
  team: z.string(),
  notes: z.string(),
  editableNotes: z.string(),
  values: z.array(z.string()),
});
export const dashboardSchema = z.object({
  headers: z.array(z.string()),
  teams: z.array(z.string()),
  records: z.array(dashboardRecordSchema),
  total: z.number().nonnegative(),
  completed: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  inspection: z.record(z.string(), z.number()),
  comparison: z.record(z.string(), z.number()),
  loadedAt: z.string().datetime(),
});
export const dashboardSaveSchema = z.object({
  record: dashboardRecordSchema,
  unchanged: z.boolean(),
});
export const photoResultSchema = z.object({
  url: safeLink,
  bytes: z.number(),
  at: z.string(),
  revision: z.string(),
});
export const passwordSchema = z.object({
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(256, 'รหัสผ่านยาวเกินกำหนด'),
});
export const detailFormSchema = z.object({
  values: z.array(z.string().max(50000, 'ข้อมูลยาวเกิน 50000 ตัวอักษร')),
});
export const dashboardDetailFormSchema = z.object({
  team: z.string(),
  notes: z.string().max(5000, 'หมายเหตุยาวเกิน 5000 ตัวอักษร'),
});
export type SearchRecord = z.infer<typeof searchRecordSchema>;
export type AssetRecord = z.infer<typeof recordSchema>;
export type DashboardRecord = z.infer<typeof dashboardRecordSchema>;
export type ReviewTarget = { sheet: string; row: number; revision: string; asset: string };
