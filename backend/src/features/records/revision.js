import { fingerprintJson } from '../../core/security/fingerprint.js';
export const fingerprintRecord = (table, record) =>
  fingerprintJson([table.headers, table.headerRow, record.values, record.formulas]);
