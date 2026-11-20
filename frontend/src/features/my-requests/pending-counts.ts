import { requestStatusValue } from '@shared/features/lending/status.js';
import type { z } from 'zod';
import type { myRequestsSchema } from '@/types/account';

export function pendingRequestCounts(records: z.infer<typeof myRequestsSchema>['records'] = []) {
  const counts = { loan: 0, returning: 0, total: 0 };
  for (const record of records) {
    if (requestStatusValue(record) !== 'รอดำเนินการ') continue;
    if (record.kind === 'ยืม') counts.loan++;
    else if (record.kind === 'คืน') counts.returning++;
    else continue;
    counts.total++;
  }
  return counts;
}
