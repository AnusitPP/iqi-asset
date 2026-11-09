import { requestStatusPresentation } from '@shared/features/lending/status.js';
export function lendingStatusColor(status: string) {
  return requestStatusPresentation(status).color;
}
