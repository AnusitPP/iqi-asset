import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SheetsPage } from '../src/features/sheets/sheets-page';
const mocks = vi.hoisted(() => ({ admin: true, request: vi.fn() }));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ can: () => mocks.admin, api: { request: mocks.request } }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function show() {
  return render(
    <MantineProvider env="test">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SheetsPage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}
it.each(['csv', 'xlsx'] as const)(
  'offers %s export to admins and downloads the server file',
  async (format) => {
    mocks.admin = true;
    mocks.request.mockImplementation(async (path: string) =>
      path.includes('/export')
        ? {
            filename: `รายงานครุภัณฑ์ ปี 70.${format}`,
            content: format === 'csv' ? '\uFEFF"ชื่อ"' : 'UEs=',
          }
        : { connected: true, sheets: [], csrf: 'test' },
    );
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:export');
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Export รายงานครุภัณฑ์ ปี 70' }));
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: format === 'csv' ? 'CSV (.csv)' : 'Excel (.xlsx)',
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(mocks.request).toHaveBeenCalledWith(
      `/api/sheets/asset-report/export?format=${format}`,
      expect.anything(),
    );
    expect(create.mock.calls[0]?.[0].type).toBe(
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  },
);
it('hides export for non-admins', () => {
  mocks.admin = false;
  show();
  expect(screen.queryByRole('button', { name: 'Export รายงานครุภัณฑ์ ปี 70' })).toBeNull();
});

it('previews only populated columns, paginates real rows and filters without inventing PDF fields', async () => {
  mocks.admin = true;
  const rows = [
    ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'S/N', 'ราคาทุน', 'สภาพ', 'รูป (ลิงก์)', 'ที่ตั้ง'],
    ...Array.from({ length: 13 }, (_, i) => [
      `ASSET-${i + 1}`,
      `อุปกรณ์ ${i + 1}`,
      `SN-${i + 1}`,
      '12345.67',
      i === 12 ? 'ชำรุด' : 'ดี',
      i === 12 ? '' : 'https://example.com/photo\njavascript:alert(1)',
      '',
    ]),
  ];
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/sheets/asset-report' ? { rows } : { connected: true, sheets: [], csrf: 'test' },
  );
  show();
  await userEvent.click(screen.getByRole('button', { name: 'พรีวิวตารางรายงาน' }));
  const table = await screen.findByRole('table', { name: 'ตารางรายการครุภัณฑ์' });
  expect(table.closest('article')?.querySelector('footer')).toBeNull();
  expect(screen.queryByText('รายการครุภัณฑ์ — ชำรุด')).toBeNull();
  expect(table.querySelectorAll('tbody tr')).toHaveLength(12);
  expect(screen.queryByRole('columnheader', { name: /^ที่$/ })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: /^รูป$/ })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'สาเหตุ' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'ที่ตั้งปัจจุบัน' })).toBeNull();
  expect(screen.getAllByText('12,345.67')).toHaveLength(12);
  expect(screen.getByText('S/N: SN-1')).toBeTruthy();
  expect(table.querySelector('a[href^="javascript:"]')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(screen.getByText('ASSET-13')).toBeTruthy();
  expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  await userEvent.selectOptions(screen.getByLabelText('กรองตามสภาพ'), 'ชำรุด');
  expect(screen.getAllByText('หน้า 1 / 1')).toHaveLength(1);
  expect(screen.queryByRole('columnheader', { name: 'รูป' })).toBeNull();
  expect(screen.getByText('ASSET-13')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'หน้าถัดไป' })).toHaveProperty('disabled', true);
});
