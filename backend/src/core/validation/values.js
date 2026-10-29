import { throwHttpError as fail } from '../errors/errors.js';
import { isIsoCalendarDate } from '../../../../shared/core/extensions/dates.js';
export const validateRequiredText = (fieldValue, maximumLength = 200, required = true) => {
  if (
    typeof fieldValue !== 'string' ||
    fieldValue.length > maximumLength ||
    (required && !fieldValue.trim())
  )
    fail(400, 'ข้อมูลไม่ครบหรือยาวเกินกำหนด');
  return fieldValue.trim();
};
export const validateIsoDate = (fieldValue) => {
  if (!isIsoCalendarDate(fieldValue)) fail(400, 'วันที่ไม่ถูกต้อง');
  return fieldValue;
};
