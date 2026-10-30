import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiClient, ApiError } from '../src/lib/api-client';
import { LendingRequestForm } from '../src/features/lending/lending-request-form';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
import { loanFormSchema, returnFormSchema } from '../src/types/lending';
import {
  saveStatusDraftsSequentially,
  type StatusDraft,
} from '../src/features/dashboard/save-drafts';
const transport = vi.fn<typeof fetch>();
const api = new ApiClient(undefined, transport);
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ api, authenticated: true, loading: false, error: null }),
}));
const catalog = {
  records: [{ row: 2, asset: 'MOUSE-001', serial: 'SN1', name: 'Mouse Wireless' }],
};
let submitted: unknown[] = [];
beforeEach(() => {
  submitted = [];
  transport.mockReset();
  transport.mockImplementation(async (path, options) => {
    if (path === '/api/loan-catalog') return Response.json(catalog);
    const payload: unknown = JSON.parse(String(options?.body));
    submitted.push(payload);
    return Response.json({ id: path === '/api/loans' ? 'L-test' : 'R-test' });
  });
});
afterEach(cleanup);
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
          <LendingRequestForm mode={mode} />
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}
async function fillCommonFields() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^ชื่อ - สกุล/), 'ทดสอบ ผู้ยืม');
  await user.selectOptions(screen.getByLabelText(/^ทีม/), 'IQI');
  await user.type(screen.getByLabelText(/^ประเภทของครุภัณฑ์/), 'mouse');
  return user;
}
async function selectCatalogAsset() {
  const user = await fillCommonFields();
  await waitFor(() => expect(transport).toHaveBeenCalled());
  await user.click(await screen.findByRole('option', { name: 'Mouse Wireless · MOUSE-001 · SN1' }));
  return user;
}
function setLoanDates(start = '2026-10-30', due = '2026-11-06') {
  fireEvent.change(screen.getByLabelText(/^วันที่ต้องการยืม/), { target: { value: start } });
  fireEvent.change(screen.getByLabelText(/^กำหนดวันส่งคืน/), { target: { value: due } });
}
describe('loan and return migration', () => {
  it('submits a selected loan with category, ISO dates and request ID through the validated API client', async () => {
    mountForm('loan');
    const user = await selectCatalogAsset();
    await user.type(screen.getByLabelText(/^เหตุผล/), 'ใช้งานประชุม');
    setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
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
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', '');
  });
  it('prevents duplicate clicks while a request is pending', async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    transport.mockImplementation(async (path, options) => {
      if (path === '/api/loan-catalog') return Response.json(catalog);
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
    expect(screen.getByLabelText(/^ชื่อ - สกุล/)).toHaveProperty('value', '');
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
  });
  it('requires selecting a catalog result instead of just typing its name', async () => {
    mountForm('loan');
    const user = await fillCommonFields();
    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText(/^เหตุผล/), 'ทดสอบ');
    setLoanDates();
    await user.click(screen.getByRole('button', { name: 'ส่ง' }));
    expect(await screen.findByText('กรุณาเลือกอุปกรณ์จากผลค้นหา')).toBeTruthy();
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
      if (path === '/api/loan-catalog') return Response.json(catalog);
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
});
describe('shared rules and task cancellation', () => {
  it('accepts seven calendar days across months, rejects eight days and reversed dates', () => {
    const values = {
      borrower: 'ทดสอบ',
      team: 'IQI',
      notes: '',
      purpose: 'ประชุม',
      start: '2026-10-30',
      due: '2026-11-06',
    };
    expect(loanFormSchema.safeParse(values).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...values, due: '2026-11-07' }).success).toBe(false);
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
