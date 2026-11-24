import { z } from 'zod';
import { userSchema } from './account';

export const sessionSchema = z.object({
  authenticated: z.boolean(),
  csrf: z.string().min(1),
  user: userSchema.nullable().optional(),
});
export const authResultSchema = z.object({ authenticated: z.boolean() });
const safeLink = z
  .string()
  .url()
  .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol));
export const statusSchema = z.object({
  connected: z.boolean(),
  csrf: z.string(),
  sheets: z.array(z.string()),
  spreadsheetUrl: safeLink.optional(),
});
export const uploadConfigSchema = z.object({ maxUploadBytes: z.number().positive() });
export const passwordSchema = z.object({
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(256, 'รหัสผ่านยาวเกินกำหนด'),
});
