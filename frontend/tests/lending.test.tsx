import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
const authState = vi.hoisted(() => ({ user: null as { name: string } | null }));
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
  records: [{ row: 2, asset: 'MOUSE-001', serial: 'SN1', name: 'Mouse Wireless' }],
};
let submitted: unknown[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T12:00:00+07:00'));
  authState.user = { name: 'ทดสอบ ผู้ยืม' };
  submitted = [];
  transport.mockReset();
  transport.mockImplementation(async (path, options) => {
    if (path === '/api/loan-catalog' || path === '/api/return-catalog')
      return Response.json(catalog);
    const payload: unknown = JSON.parse(String(options?.body));
    submitted.push(payload);
    return Response.json({ id: path === '/api/loans' ? 'L-test' : 'R-test' });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mountForm(
  mode: 'loan' | 'return',
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
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
async function fillCommonFields() {
  const user = userEvent.setup();
  expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', authState.user?.name);
  expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('readOnly', true);
  await user.selectOptions(screen.getByLabelText(/^ทีม/), 'IQI');
  await user.type(screen.getByLabelText(/^ประเภทของครุภัณฑ์/), 'mouse');
  return user;
}
async function selectCatalogAsset(mode: 'loan' | 'return' = 'return') {
  if (mode === 'loan') {
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'ค้นหาอุปกรณ์' }), 'mouse');
    await user.click(
      await screen.findByRole('button', { name: 'เลือกยืม Mouse Wireless MOUSE-001 SN1' }),
    );
    await screen.findByRole('dialog');
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', authState.user?.name);
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('readOnly', true);
    await user.selectOptions(screen.getByLabelText(/^ทีม/), 'IQI');
    return user;
  }
  const user = await fillCommonFields();
  await waitFor(() => expect(transport).toHaveBeenCalled());
  await user.click(await screen.findByRole('option', { name: 'Mouse Wireless · MOUSE-001 · SN1' }));
  return user;
}
async function setLoanDates(start = '2026-10-30', due = '2026-11-06') {
  const user = userEvent.setup();
  for (const [label, date] of [
    [/^วันที่ต้องการยืม/, start],
    [/^กำหนดวันส่งคืน/, due],
  ] as const) {
    await user.click(screen.getByLabelText(label));
    const dayLabel = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00+07:00`));
    if (!screen.queryByRole('button', { name: dayLabel }))
      await user.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await user.click(screen.getByRole('button', { name: dayLabel }));
  }
}
describe('loan and return migration', () => {
  it('reports a saved loan with failed email without asking for another submission', async () => {
    const originalTransport = transport.getMockImplementation()!;
    transport.mockImplementation(async (path, options) => {
      if (path === '/api/loans') return Response.json({ id: 'L-test', mailNotification: 'failed' });
      return originalTransport(path, options);
    });
    mountForm('loan');
    const user = await selectCatalogAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'Meeting');
    await setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอยืม' }));
    expect(
      await screen.findByText(/บันทึกคำขอแล้ว แต่ส่งอีเมลไม่สำเร็จ ไม่ต้องส่งคำขอซ้ำ/),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(transport.mock.calls.filter(([path]) => path === '/api/loans')).toHaveLength(1);
  });
  it('prefills the signed-in Google name and keeps it read-only after clearing the form', async () => {
    authState.user = { name: 'Google Profile User' };
    mountForm('return');
    const borrower = screen.getByLabelText(/^ชื่อ - สกุล/);
    expect(borrower).toHaveProperty('value', 'Google Profile User');
    expect(borrower).toHaveProperty('readOnly', true);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'draft');
    await user.click(screen.getByRole('button', { name: 'ล้างแบบฟอร์ม' }));
    expect(borrower).toHaveProperty('value', 'Google Profile User');
    expect(screen.getByLabelText('หมายเหตุ (ถ้ามี)')).toHaveProperty('value', '');
  });
  it('submits a selected loan with category, ISO dates and request ID through the validated API client', async () => {
    mountForm('loan');
    const user = await selectCatalogAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'ใช้งานประชุม');
    await setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่งคำขอยืม' }));
    expect(await screen.findByText(/ส่งคำร้องยืมสำเร็จ · L-test/)).toBeTruthy();
    expect(submitted[0]).toMatchObject({
      borrower: 'ทดสอบ ผู้ยืม',
      team: 'IQI',
      category: 'เมาส์ (Mouse)',
      selectedAsset: { asset: 'MOUSE-001', serial: 'SN1' },
      identifier: 'MOUSE-001 / SN1',
      purpose: 'ใช้งานประชุม',
      start: '2026-10-30',
      due: '2026-11-06',
      notes: '',
    });
    expect(z.object({ requestId: z.string().uuid() }).parse(submitted[0]).requestId).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('prevents duplicate clicks while a request is pending', async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    transport.mockImplementation(async (path, options) => {
      if (path === '/api/loan-catalog' || path === '/api/return-catalog')
        return Response.json(catalog);
      const payload: unknown = JSON.parse(String(options?.body));
      submitted.push(payload);
      return new Promise<Response>((resolve) => {
        finishRequest = resolve;
      });
    });
    mountForm('return');
    const user = await selectCatalogAsset();
    fireEvent.change(screen.getByLabelText(/^วันที่ส่งคืน/), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    expect(screen.getByRole('button', { name: 'ส่ง' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    expect(submitted).toHaveLength(1);
    await act(async () => {
      finishRequest?.(Response.json({ id: 'R-pending-test' }));
    });
    expect(await screen.findByText(/ส่งคำร้องคืนสำเร็จ · R-pending-test/)).toBeTruthy();
  });
  it('clears the form, catalog selection and restored draft together', async () => {
    mountForm('return');
    const user = await selectCatalogAsset();
    await user.click(screen.getByRole('button', { name: 'ล้างแบบฟอร์ม' }));
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', 'ทดสอบ ผู้ยืม');
    expect(screen.getByLabelText(/^ประเภทของครุภัณฑ์/)).toHaveProperty('value', '');
    expect(screen.getByLabelText(/^เลขครุภัณฑ์/)).toHaveProperty('value', '');
  });
  it('sends a return using the existing return payload without loan fields', async () => {
    mountForm('return');
    const user = await selectCatalogAsset();
    fireEvent.change(screen.getByLabelText(/^วันที่ส่งคืน/), { target: { value: '2026-11-01' } });
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'คืนครบ');
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    expect(await screen.findByText(/ส่งคำร้องคืนสำเร็จ · R-test/)).toBeTruthy();
    expect(submitted[0]).toMatchObject({
      date: '2026-11-01',
      notes: 'คืนครบ',
      selectedAsset: { asset: 'MOUSE-001', serial: 'SN1' },
    });
    expect(submitted[0]).not.toHaveProperty('purpose');
    expect(submitted[0]).not.toHaveProperty('start');
    expect(submitted[0]).not.toHaveProperty('due');
    expect(submitted[0]).not.toHaveProperty('mode');
    expect(transport.mock.calls.some(([path]) => path === '/api/return-catalog')).toBe(true);
    expect(transport.mock.calls.some(([path]) => path === '/api/loan-catalog')).toBe(false);
  });
  it('requires selecting an asset before opening the loan form', async () => {
    mountForm('loan');
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'ค้นหาอุปกรณ์' }), 'mouse');
    await screen.findByRole('button', { name: 'เลือกยืม Mouse Wireless MOUSE-001 SN1' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ส่งคำขอยืม' })).toBeNull();
    expect(submitted).toHaveLength(0);
  });
  it('supports keyboard catalog selection', async () => {
    mountForm('return');
    const user = await fillCommonFields();
    await screen.findByRole('option', { name: /Mouse Wireless/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByText('เลือกแล้ว: MOUSE-001')).toBeTruthy();
  });
  it('reuses the request ID after an uncertain server failure and changes it after editing', async () => {
    let calls = 0;
    transport.mockImplementation(async (path, options) => {
      if (path === '/api/loan-catalog' || path === '/api/return-catalog')
        return Response.json(catalog);
      const payload: unknown = JSON.parse(String(options?.body));
      submitted.push(payload);
      calls++;
      return Response.json({ error: 'ยืนยันการบันทึกไม่ได้ กรุณาลองคำขอเดิม' }, { status: 502 });
    });
    mountForm('return');
    const user = await selectCatalogAsset();
    fireEvent.change(screen.getByLabelText(/^วันที่ส่งคืน/), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    await screen.findByText(/HTTP 502/);
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    await waitFor(() => expect(calls).toBe(2));
    const requestId = z.object({ requestId: z.string() });
    expect(requestId.parse(submitted[0]).requestId).toBe(requestId.parse(submitted[1]).requestId);
    await user.type(screen.getByLabelText('หมายเหตุ (ถ้ามี)'), 'แก้ไข');
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    await waitFor(() => expect(calls).toBe(3));
    expect(requestId.parse(submitted[2]).requestId).not.toBe(
      requestId.parse(submitted[1]).requestId,
    );
  });
  it('preserves a form and its selected asset across route unmount/remount', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = mountForm('return', client);
    await selectCatalogAsset();
    fireEvent.change(screen.getByLabelText(/^วันที่ส่งคืน/), { target: { value: '2026-11-01' } });
    page.unmount();
    mountForm('return', client);
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', 'ทดสอบ ผู้ยืม');
    expect(screen.getByLabelText(/^เลขครุภัณฑ์/)).toHaveProperty('value', 'MOUSE-001 / SN1');
    expect(screen.getByLabelText(/^วันที่ส่งคืน/)).toHaveProperty('value', '2026-11-01');
  });
  it('keeps loan and return drafts separate when switching between their pages', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const loanPage = mountForm('loan', client);
    const user = await selectCatalogAsset('loan');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'ประชุมทีม');
    await setLoanDates();
    loanPage.unmount();

    const returnPage = mountForm('return', client);
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', 'ทดสอบ ผู้ยืม');
    expect(screen.getByLabelText(/^เลขครุภัณฑ์/)).toHaveProperty('value', '');
    expect(screen.queryByLabelText(/^เหตุผล/)).toBeNull();
    await selectCatalogAsset();
    fireEvent.change(screen.getByLabelText(/^วันที่ส่งคืน/), { target: { value: '2026-11-02' } });
    returnPage.unmount();

    const restoredLoan = mountForm('loan', client);
    await user.click(
      await screen.findByRole('button', { name: 'เลือกยืม Mouse Wireless MOUSE-001 SN1' }),
    );
    expect(screen.getByLabelText(/^เหตุผล/)).toHaveProperty('value', 'ประชุมทีม');
    expect(screen.getByLabelText(/^วันที่ต้องการยืม/).textContent).toContain('30 ตุลาคม 2026');
    expect(screen.getByLabelText(/^กำหนดวันส่งคืน/).textContent).toContain('06 พฤศจิกายน 2026');
    expect(screen.getByRole('dialog').textContent).toContain('MOUSE-001');
    restoredLoan.unmount();

    mountForm('return', client);
    expect(screen.getByLabelText(/^วันที่ส่งคืน/)).toHaveProperty('value', '2026-11-02');
    expect(screen.queryByLabelText(/^วันที่ต้องการยืม/)).toBeNull();
  });
});
describe('shared rules and task cancellation', () => {
  it('accepts loans over seven days but rejects reversed or invalid dates', () => {
    const values = {
      borrower: 'ทดสอบ',
      team: 'IQI',
      notes: '',
      purpose: 'ประชุม',
      start: '2026-10-30',
      due: '2026-11-06',
    };
    expect(loanFormSchema.safeParse(values).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...values, due: '2026-11-07' }).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...values, due: '2026-11-20' }).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...values, due: '2026-10-29' }).success).toBe(false);
    expect(
      returnFormSchema.safeParse({
        borrower: 'ทดสอบ',
        team: 'invalid',
        notes: '',
        date: '2026-02-30',
      }).success,
    ).toBe(false);
  });
  it('stops sequential writes after the session scope is no longer current', async () => {
    let current = true;
    const save = vi.fn(async () => {
      current = false;
      return 'saved';
    });
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'r1' }],
      [3, { status: 'ดี', revision: 'r2' }],
    ]);
    await saveStatusDraftsSequentially(drafts, save, undefined, () => current);
    expect(save).toHaveBeenCalledTimes(1);
    expect(drafts.has(3)).toBe(true);
  });
  it('stops bulk writes on a 401 response rather than continuing with the next row', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError('หมดอายุ', 401));
    const drafts = new Map<number, StatusDraft>([
      [2, { status: 'ดี', revision: 'r1' }],
      [3, { status: 'ดี', revision: 'r2' }],
    ]);
    await saveStatusDraftsSequentially(drafts, save);
    expect(save).toHaveBeenCalledTimes(1);
    expect(drafts.size).toBe(2);
  });
});
