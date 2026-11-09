import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiClient, ApiError } from '../src/lib/api-client';
import { LoansPage } from '../src/features/loans/loans-page';
import { ReturnsPage } from '../src/features/returns/returns-page';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
import { loanFormSchema, returnFormSchema } from '../src/types/lending';
import {
  saveStatusDraftsSequentially,
  type StatusDraft,
} from '../src/features/dashboard/save-drafts';

const transport = vi.fn<typeof fetch>();
const api = new ApiClient(undefined, transport);
const authState = vi.hoisted(() => ({ user: { id: 'user-1', name: 'Fixture User' } }));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api,
    user: authState.user,
    authenticated: true,
    loading: false,
    error: null,
  }),
}));
const catalog = {
  records: [{ row: 2, asset: 'MOUSE-001', serial: 'SN1', name: 'Mouse Wireless', team: 'IQI' }],
};
let submitted: unknown[];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T12:00:00+07:00'));
  authState.user.name = 'Fixture User';
  submitted = [];
  transport.mockReset();
  transport.mockImplementation(async (path, options) => {
    if (path === '/api/loan-catalog' || path === '/api/return-catalog')
      return Response.json(catalog);
    submitted.push(JSON.parse(String(options?.body)));
    return Response.json({ id: path === '/api/loans' ? 'L-test' : 'R-test' });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const createClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function mount(mode: 'loan' | 'return', client = createClient()) {
  return render(
    <MantineProvider env="test">
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>
          {mode === 'loan' ? <LoansPage /> : <ReturnsPage />}
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}
async function selectAsset(mode: 'loan' | 'return') {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: `${mode === 'loan' ? 'ยืม' : 'คืน'} Mouse Wireless MOUSE-001 SN1`,
    }),
  );
  await screen.findByRole('dialog');
  expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', authState.user.name);
  expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('readOnly', true);
  if (mode === 'loan') await user.selectOptions(screen.getByLabelText(/^ทีม/), 'IQI');
  return user;
}
async function setLoanDates() {
  const user = userEvent.setup();
  for (const [label, date] of [
    [/^วันที่ต้องการยืม/, '2026-10-30'],
    [/^กำหนดวันส่งคืน/, '2026-11-06'],
  ] as const) {
    await user.click(screen.getByLabelText(label));
    const day = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00+07:00`));
    if (!screen.queryByRole('button', { name: day }))
      await user.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await user.click(screen.getByRole('button', { name: day }));
  }
}
describe('Google authenticated loan and return forms', () => {
  it('reports a saved loan with failed email without another submission', async () => {
    const original = transport.getMockImplementation()!;
    transport.mockImplementation((path, options) =>
      path === '/api/loans'
        ? Promise.resolve(Response.json({ id: 'L-test', mailNotification: 'failed' }))
        : original(path, options),
    );
    mount('loan');
    const user = await selectAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'Meeting');
    await setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอยืม' }));
    expect(
      await screen.findByText(/บันทึกคำขอแล้ว แต่ส่งอีเมลไม่สำเร็จ ไม่ต้องส่งคำขอซ้ำ/),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(transport.mock.calls.filter(([path]) => path === '/api/loans')).toHaveLength(1);
  });
  it('keeps Google identity read-only when clearing and reopening a return', async () => {
    authState.user.name = 'Google Profile User';
    mount('return');
    const user = await selectAsset('return');
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'draft');
    await user.click(screen.getByRole('button', { name: 'ล้างแบบฟอร์ม' }));
    await selectAsset('return');
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', 'Google Profile User');
    expect(screen.getByLabelText('หมายเหตุ (ถ้ามี)')).toHaveProperty('value', '');
  });
  it('submits selected loan details, calendar dates and request ID', async () => {
    mount('loan');
    const user = await selectAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'Meeting');
    await setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอยืม' }));
    expect(await screen.findByText(/ส่งคำร้องยืมสำเร็จ · L-test/)).toBeTruthy();
    expect(submitted[0]).toMatchObject({
      borrower: 'Fixture User',
      team: 'IQI',
      selectedAsset: { asset: 'MOUSE-001', serial: 'SN1' },
      purpose: 'Meeting',
      start: '2026-10-30',
      due: '2026-11-06',
    });
    expect(z.object({ requestId: z.string().uuid() }).parse(submitted[0]).requestId).toBeTruthy();
  });
  it('prevents duplicate clicks while a return is pending', async () => {
    const original = transport.getMockImplementation()!;
    let finish: (response: Response) => void;
    transport.mockImplementation((path, options) =>
      path === '/api/returns'
        ? new Promise((resolve) => {
            submitted.push(JSON.parse(String(options?.body)));
            finish = resolve;
          })
        : original(path, options),
    );
    mount('return');
    const user = await selectAsset('return');
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    expect(screen.getByRole('button', { name: 'ส่งคำขอคืน' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    expect(submitted).toHaveLength(1);
    await act(async () => finish(Response.json({ id: 'R-pending' })));
    expect(await screen.findByText(/ส่งคำร้องคืนสำเร็จ · R-pending/)).toBeTruthy();
  });
  it('clears return draft and selection together', async () => {
    mount('return');
    const user = await selectAsset('return');
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'ล้างแบบฟอร์ม' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await selectAsset('return');
    expect(screen.getByLabelText('หมายเหตุ (ถ้ามี)')).toHaveProperty('value', '');
  });
  it('uses current return date and selected team without loan-only fields', async () => {
    mount('return');
    const user = await selectAsset('return');
    expect(screen.getByLabelText(/^วันที่ส่งคืน/)).toHaveProperty('value', '2026-10-30');
    expect(screen.getByLabelText(/^วันที่ส่งคืน/)).toHaveProperty('disabled', true);
    expect(screen.getByLabelText(/^ทีม/)).toHaveProperty('value', 'IQI');
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'Complete');
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    await screen.findByText(/ส่งคำร้องคืนสำเร็จ · R-test/);
    expect(submitted[0]).toMatchObject({
      date: '2026-10-30',
      team: 'IQI',
      notes: 'Complete',
      selectedAsset: { asset: 'MOUSE-001', serial: 'SN1' },
    });
    for (const key of ['purpose', 'start', 'due', 'mode'])
      expect(submitted[0]).not.toHaveProperty(key);
    expect(transport.mock.calls.some(([path]) => path === '/api/loan-catalog')).toBe(false);
  });
  it('requires selecting an asset before opening a form', async () => {
    mount('loan');
    await screen.findByRole('button', { name: 'ยืม Mouse Wireless MOUSE-001 SN1' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ส่งคำขอยืม' })).toBeNull();
    expect(submitted).toHaveLength(0);
  });
  it('supports opening a catalog selection by keyboard', async () => {
    mount('return');
    const button = await screen.findByRole('button', { name: 'คืน Mouse Wireless MOUSE-001 SN1' });
    button.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText(/^เลขครุภัณฑ์/)).toHaveProperty('value', 'MOUSE-001 / SN1');
  });
  it('reuses request ID after uncertain failure but changes it after editing', async () => {
    const original = transport.getMockImplementation()!;
    transport.mockImplementation((path, options) => {
      if (path !== '/api/returns') return original(path, options);
      submitted.push(JSON.parse(String(options?.body)));
      return Promise.resolve(Response.json({ error: 'Cannot verify save' }, { status: 502 }));
    });
    mount('return');
    const user = await selectAsset('return');
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    await screen.findByText(/HTTP 502/);
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    await waitFor(() => expect(submitted).toHaveLength(2));
    const schema = z.object({ requestId: z.string() });
    expect(schema.parse(submitted[0]).requestId).toBe(schema.parse(submitted[1]).requestId);
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'Edited');
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอคืน' }));
    await waitFor(() => expect(submitted).toHaveLength(3));
    expect(schema.parse(submitted[2]).requestId).not.toBe(schema.parse(submitted[1]).requestId);
  });
  it('restores return draft after route remount and reopening the item', async () => {
    const client = createClient();
    const page = mount('return', client);
    const user = await selectAsset('return');
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'Return draft');
    page.unmount();
    mount('return', client);
    await selectAsset('return');
    expect(screen.getByLabelText('หมายเหตุ (ถ้ามี)')).toHaveProperty('value', 'Return draft');
  });
  it('keeps loan and return drafts separate', async () => {
    const client = createClient();
    const loan = mount('loan', client);
    const user = await selectAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'Loan draft');
    await setLoanDates();
    loan.unmount();
    const returning = mount('return', client);
    await selectAsset('return');
    expect(screen.queryByLabelText(/^เหตุผล/)).toBeNull();
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'Return draft');
    returning.unmount();
    const restored = mount('loan', client);
    await selectAsset('loan');
    expect(screen.getByLabelText(/^เหตุผล/)).toHaveProperty('value', 'Loan draft');
    expect(screen.getByLabelText(/^กำหนดวันส่งคืน/).textContent).toContain('06 พฤศจิกายน 2026');
    restored.unmount();
    mount('return', client);
    await selectAsset('return');
    expect(screen.getByLabelText('หมายเหตุ (ถ้ามี)')).toHaveProperty('value', 'Return draft');
  });
});
describe('validation and cancellation', () => {
  it('rejects past start dates, loans over seven days and invalid calendar dates', () => {
    const values = {
      borrower: 'Fixture User',
      team: 'IQI',
      notes: '',
      purpose: 'Meeting',
      start: '2026-10-30',
      due: '2026-11-06',
    };
    expect(loanFormSchema.safeParse(values).success).toBe(true);
    for (const change of [{ start: '2026-10-29' }, { due: '2026-11-07' }, { due: '2026-10-29' }])
      expect(loanFormSchema.safeParse({ ...values, ...change }).success).toBe(false);
    expect(
      returnFormSchema.safeParse({
        borrower: 'Fixture User',
        team: 'IQI',
        notes: '',
        date: '2026-02-30',
      }).success,
    ).toBe(false);
  });
  it('stops writes after leaving the session', async () => {
    let current = true;
    const save = vi.fn(async () => {
      current = false;
      return 'saved';
    });
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'a' }],
      [3, { status: 'ดี', revision: 'b' }],
    ]);
    await saveStatusDraftsSequentially(drafts, save, undefined, () => current);
    expect(save).toHaveBeenCalledTimes(1);
    expect(drafts.has(3)).toBe(true);
  });
  it('stops bulk writes on 401', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401));
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'a' }],
      [3, { status: 'ดี', revision: 'b' }],
    ]);
    await saveStatusDraftsSequentially(drafts, save);
    expect(save).toHaveBeenCalledTimes(1);
    expect(drafts.size).toBe(2);
  });
});
it('return cards reuse loan timing and show loan details before the return form', async () => {
  const original = transport.getMockImplementation()!;
  transport.mockImplementation((path, options) =>
    path === '/api/return-catalog'
      ? Promise.resolve(
          Response.json({
            records: [
              {
                ...catalog.records[0],
                loanId: 'STeP-IQI-L-fixture',
                start: '2026-10-29',
                due: '2026-11-02',
                status: 'กำลังยืม',
                borrower: 'Fixture User',
                purpose: 'Meeting',
                adminComment: 'กรุณาคืนตามกำหนด',
              },
            ],
          }),
        )
      : original(path, options),
  );
  mount('return');
  expect(await screen.findByText('เลขคำขอ: STeP-IQI-L-fixture')).toBeTruthy();
  expect(screen.getAllByText('เหลือ 3 วัน')).toHaveLength(2);
  expect(screen.getByText('1 / 4 วัน')).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'คืน Mouse Wireless MOUSE-001 SN1' }));
  expect(await screen.findByRole('dialog', { name: /รายละเอียดรายการของฉัน/ })).toBeTruthy();
  expect(screen.getByText('Meeting')).toBeTruthy();
  expect(screen.getByText('คอมเมนต์จากแอดมิน: กรุณาคืนตามกำหนด')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'คัดลอก STeP-IQI-L-fixture' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ส่งคำขอคืน' })).toBeTruthy();
});
