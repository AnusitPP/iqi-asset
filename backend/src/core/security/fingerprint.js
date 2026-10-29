import { createHash } from 'node:crypto';
export const fingerprintJson = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
