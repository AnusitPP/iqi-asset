import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SheetsPage } from '../src/features/sheets/sheets-page';
const mocks = vi.hoisted(() => ({
  admin: true,
  request: vi.fn(),
  capture: vi.fn(),
  save: vi.fn(),
}));
vi.mock('html-to-image', () => ({
  getFontEmbedCSS: async () => '',
  toCanvas: async (page: HTMLElement) => {
    mocks.capture(page.textContent);
    return document.createElement('canvas');
  },
}));
vi.mock('jspdf', () => ({
  jsPDF: class {
    addPage() {}
    addImage() {}
    save = mocks.save;
  },
}));
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

it('searches report entries and only moves the chosen row after confirmation', async () => {
  mocks.admin = true;
  const rows = [
    ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'S/N'],
    ['A-1', 'จอ', 'SN-1'],
    [],
    ['A-2', 'โต๊ะ', 'SN-2'],
  ];
  mocks.request.mockImplementation(async (path: string) => {
    if (path.endsWith('/trash')) {
      rows[3] = [];
      return { ok: true };
    }
    if (path === '/api/sheets/asset-report') return { rows: structuredClone(rows) };
    return { connected: true, sheets: [], csrf: 'test' };
  });
  show();
  await userEvent.click(screen.getByRole('button', { name: 'พรีวิวตารางรายงาน' }));
  await userEvent.click(await screen.findByRole('button', { name: 'จัดการรายการ' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'ค้นหารายการ' }), 'SN-2');
  expect(screen.queryByRole('button', { name: /ลบรายการ A-1/ })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /ลบรายการ A-2/ }));
  expect(mocks.request).not.toHaveBeenCalledWith(
    '/api/sheets/asset-report/trash',
    expect.anything(),
    expect.anything(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'ย้ายไปถัง' }));
  await screen.findByText('ไม่พบรายการ');
  expect(mocks.request).toHaveBeenCalledWith('/api/sheets/asset-report/trash', expect.anything(), {
    method: 'POST',
    body: { row: 4, values: ['A-2', 'โต๊ะ', 'SN-2'] },
  });
});

it('fills each A4 page using measured rows and leaves remaining rows on the last page', async () => {
  mocks.admin = true;
  const rows = [
    ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์'],
    ...Array.from({ length: 45 }, (_, index) => [`A-${index + 1}`, 'อุปกรณ์']),
  ];
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/sheets/asset-report' ? { rows } : { connected: true, sheets: [], csrf: 'test' },
  );
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
    const style = computedStyle(node);
    if (node.tagName === 'ARTICLE') {
      style.minHeight = '1123px';
      style.paddingBottom = '36px';
    }
    if (node.tagName === 'H2') style.marginBottom = '24px';
    return style;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.tagName === 'TBODY') return new DOMRect(0, 160, 698, 45 * 45);
    if (this.tagName === 'TR') return new DOMRect(0, 0, 698, 45);
    if (this.tagName === 'H2') return new DOMRect(0, 56, 698, 36);
    return new DOMRect();
  });
  show();
  await userEvent.click(screen.getByRole('button', { name: 'พรีวิวตารางรายงาน' }));
  const table = await screen.findByRole('table', { name: 'ตารางรายการครุภัณฑ์' });
  await waitFor(() => expect(table.querySelectorAll('tbody tr')).toHaveLength(20));
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(table.querySelectorAll('tbody tr')).toHaveLength(21);
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(table.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(table.textContent).toContain('A-45');
});

it('groups conditions in report order and summarizes the rows matching the price filter', async () => {
  mocks.admin = true;
  const rows = [
    ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'สภาพ', 'ราคาทุน'],
    ['A-1', 'อุปกรณ์', 'ชำรุด', ''],
    ['A-2', 'อุปกรณ์', 'ดี', '1,200.50'],
    ['A-3', 'อุปกรณ์', 'หาไม่เจอ', '0'],
  ];
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/sheets/asset-report' ? { rows } : { connected: true, sheets: [], csrf: 'test' },
  );
  show();
  await userEvent.click(screen.getByRole('button', { name: 'พรีวิวตารางรายงาน' }));
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'เรียงและแยกตารางตามสภาพการใช้งาน' }),
  );
  expect(screen.getByRole('table', { name: '1. รายการดี' })).toBeTruthy();
  expect(
    within(screen.getByRole('table', { name: 'สรุปรายการครุภัณฑ์' })).getByText('1,200.50'),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole('checkbox', { name: 'ตารางขนาดเล็ก' }));
  const summaryOptions = screen.getByRole('group', { name: 'ซ่อนคอลัมน์ในตารางสรุปขนาดเล็ก' });
  const detailOptions = screen.getByRole('group', { name: 'ซ่อนคอลัมน์ในตารางรายการขนาดเล็ก' });
  await userEvent.click(
    within(summaryOptions).getByRole('checkbox', { name: 'มูลค่าตามทะเบียน (บาท)' }),
  );
  await userEvent.click(within(detailOptions).getByRole('checkbox', { name: 'ราคาทุน' }));
  expect(screen.queryByRole('columnheader', { name: 'มูลค่าตามทะเบียน (บาท)' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'ราคาทุน' })).toBeNull();
  await userEvent.click(screen.getByRole('checkbox', { name: 'ตารางขนาดเล็ก' }));
  expect(screen.getByRole('columnheader', { name: 'มูลค่าตามทะเบียน (บาท)' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'ราคาทุน' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(screen.getByRole('table', { name: '2. รายการชำรุด' })).toBeTruthy();
  expect(screen.queryByRole('table', { name: 'สรุปรายการครุภัณฑ์' })).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText('กรองตามราคาทุน'), 'มีราคาทุน');
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(screen.getByRole('table', { name: '2. รายการหาไม่เจอ' })).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('กรองตามราคาทุน'), 'ไม่มีราคาทุน');
  expect(screen.getByRole('table', { name: '1. รายการชำรุด' })).toBeTruthy();
});

it('only prints grouped table headings when a condition starts', async () => {
  mocks.admin = true;
  const rows = [
    ['เลขครุภัณฑ์', 'ชื่ออุปกรณ์', 'สภาพ'],
    ...Array.from({ length: 13 }, (_, index) => [`A-${index + 1}`, 'อุปกรณ์', 'ดี']),
    ['B-1', 'อุปกรณ์', 'ชำรุด'],
  ];
  mocks.request.mockImplementation(async (path: string) =>
    path === '/api/sheets/asset-report' ? { rows } : { connected: true, sheets: [], csrf: 'test' },
  );
  show();
  await userEvent.click(screen.getByRole('button', { name: 'พรีวิวตารางรายงาน' }));
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'เรียงและแยกตารางตามสภาพการใช้งาน' }),
  );
  const next = screen.getByRole('button', { name: 'หน้าถัดไป' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'แสดงเลขลำดับ (ที่)' }));
  expect(screen.getByRole('columnheader', { name: 'ที่' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'เลขครุภัณฑ์' })).toBeTruthy();
  await userEvent.click(next);
  const continuation = screen.getByRole('table', { name: '1. รายการดี' });
  expect(within(continuation).getByText('A-13')).toBeTruthy();
  expect(within(continuation).getAllByRole('cell')[0]?.textContent).toBe('13');
  expect(continuation.previousElementSibling).toBeNull();
  expect(within(continuation).queryByRole('columnheader')).toBeNull();
  await userEvent.click(next);
  const damaged = screen.getByRole('table', { name: '2. รายการชำรุด' });
  expect(damaged.previousElementSibling?.textContent).toBe('2. รายการชำรุด');
  expect(within(damaged).getByRole('columnheader', { name: 'เลขครุภัณฑ์' })).toBeTruthy();
  expect(within(damaged).getAllByRole('cell')[0]?.textContent).toBe('1');
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
  expect(within(table).getAllByText('12,345.67')).toHaveLength(12);
  expect(within(table).getByText('S/N: SN-1')).toBeTruthy();
  expect(table.querySelector('a[href^="javascript:"]')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(within(table).getByText('ASSET-13')).toBeTruthy();
  expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  await userEvent.selectOptions(screen.getByLabelText('กรองตามสภาพ'), 'ชำรุด');
  expect(screen.getAllByText('หน้า 1 / 1')).toHaveLength(1);
  expect(screen.queryByRole('columnheader', { name: 'รูป' })).toBeNull();
  expect(within(table).getByText('ASSET-13')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'หน้าถัดไป' })).toHaveProperty('disabled', true);
  await userEvent.click(screen.getByRole('button', { name: 'เลือกข้อมูลสำหรับ PDF' }));
  await userEvent.selectOptions(screen.getByLabelText('กรองตามสภาพ'), 'ทั้งหมด');
  const title = screen.getByRole('textbox', { name: 'ชื่อรายงาน' });
  await userEvent.clear(title);
  await userEvent.type(title, 'รายงานทดสอบ');
  expect(screen.getByRole('heading', { name: 'รายงานทดสอบ' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'หน้าถัดไป' }));
  expect(screen.queryByRole('heading', { name: 'รายงานทดสอบ' })).toBeNull();
  await userEvent.click(screen.getByRole('checkbox', { name: 'รวมหน้า 1' }));
  expect(screen.getByRole('heading', { name: 'รายงานทดสอบ' })).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('กรองตามสภาพ'), 'ชำรุด');
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด PDF' })).toHaveProperty('disabled', false);
  await userEvent.click(screen.getByRole('checkbox', { name: 'ราคาทุน' }));
  expect(screen.queryByRole('columnheader', { name: 'ราคาทุน' })).toBeNull();
  await userEvent.click(screen.getByRole('checkbox', { name: 'ASSET-13' }));
  expect(table.textContent).toContain('ไม่มีรายการ');
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด PDF' })).toHaveProperty('disabled', true);
  await userEvent.click(screen.getByRole('checkbox', { name: 'ASSET-13' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'รวมหน้า 1' }));
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด PDF' })).toHaveProperty('disabled', true);
  await userEvent.click(screen.getByRole('checkbox', { name: 'รวมหน้า 1' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'ตารางขนาดเล็ก' }));
  expect(table.closest('article')?.className).toMatch(/compact/);
  await userEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลด PDF' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('รายงานครุภัณฑ์ ปี 70.pdf'));
  expect(mocks.capture).toHaveBeenCalledTimes(1);
  expect(mocks.capture.mock.calls[0]?.[0]).toContain('ASSET-13');
  expect(mocks.capture.mock.calls[0]?.[0]).toContain('รายงานทดสอบ');
  expect(mocks.capture.mock.calls[0]?.[0]).not.toContain('ราคาทุน');
});
