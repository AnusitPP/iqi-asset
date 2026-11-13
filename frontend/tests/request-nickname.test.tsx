import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { RequestDetailsSummary } from '../src/components/core/request-details-summary';
import { myRequestsSchema } from '../src/types/account';

afterEach(cleanup);
it.each(['Nick', ''])('shows borrower nickname only when supplied: %s', (borrowerNickname) => {
  const record = myRequestsSchema.parse({
    records: [
      {
        id: 'loan',
        kind: 'ยืม',
        name: 'Mouse',
        borrower: 'Full Name',
        borrowerNickname,
      },
    ],
  }).records[0]!;
  render(
    <MantineProvider>
      <RequestDetailsSummary record={record} today="2026-11-13" />
    </MantineProvider>,
  );
  expect(screen.getByText(borrowerNickname ? 'Full Name (Nick)' : 'Full Name')).toBeTruthy();
});
