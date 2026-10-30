import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssetRecordDialog } from '../src/features/assets/record-dialog';
import { ReviewInspectionDialog } from '../src/features/inspections/inspection-dialog';
import { AssetPhotoEditor } from '../src/features/photos/photo-editor';
import { dashboardRecordSchema } from '../src/types/contracts';
import { ApiClient } from '../src/lib/api-client';
import { AssetsPage } from '../src/features/assets/assets-page';
import { DashboardPage } from '../src/features/dashboard/dashboard-page';
import { LoginPage } from '../src/features/auth/login-page';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  loginWithPassword: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    api: { request: mocks.request },
    authenticated: true,
    loading: false,
    error: null,
    loginWithPassword: mocks.loginWithPassword,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
const record = {
  row: 2,
  sourceSheet: 'IQI',
  asset: 'IQI-001',
  name: 'จอ',
  brand: 'Brand',
  owner: 'ผู้ถือครอง',
  initials: '',
  nickname: '',
  team: '1. IT',
  inspectionDate: '',
  pending: false,
  reviewSheet: '',
  inspected: false,
  inspectionStatus: '',
  revision: 'r1',
};
const dashRecord = {
  row: 2,
  revision: 'd1',
  updatedAt: '',
  asset: 'IQI-001',
  name: 'จอ',
  serial: 'SN1',
  inspection: 'ยังไม่ตรวจ',
  comparison: 'ตรงกัน',
  owner: 'ผู้ถือครอง',
  team: 'IT',
  notes: '',
  editableNotes: '',
  values: ['IQI-001', 'จอ', 'IT', ''],
};
const dashboard = {
  headers: ['เลขครุภัณฑ์ Apps Script', 'ชื่ออุปกรณ์ Apps Script', 'ทีม', 'หมายเหตุ'],
  teams: ['IT'],
  records: [dashRecord],
  total: 1,
  completed: 0,
  percent: 0,
  inspection: { ยังไม่ตรวจ: 1 },
  comparison: { ตรงกัน: 1 },
  loadedAt: '2026-10-29T00:00:00.000Z',
};
function renderWithAppProviders(component: React.ReactNode) {
  return render(
    <MantineProvider>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <UnsavedChangesProvider>{component}</UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
}
beforeEach(() => {
  mocks.request.mockReset();
  mocks.loginWithPassword.mockReset();
  mocks.replace.mockReset();
});
afterEach(cleanup);
describe('migrated interactions', () => {
  it('searches after typing and sends authoritative revision for review selection', async () => {
    mocks.request.mockImplementation(async (path: string) =>
      path.startsWith('/api/search')
        ? {
            query: 'จอ',
            pendingOnly: false,
            groups: [
              {
                sheet: 'IQI',
                label: 'IQI',
                editable: true,
                count: 1,
                matchType: 'partial',
                records: [record],
              },
            ],
          }
        : { pending: true, revision: 'r2' },
    );
    renderWithAppProviders(<AssetsPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('ค้นหาข้อมูลครุภัณฑ์'), 'จอ');
    expect(await screen.findByText('IQI-001')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'ตั้งสถานะรอค้นหา' }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        '/api/review-selection',
        expect.objectContaining({}),
        expect.objectContaining({
          method: 'PUT',
          body: { sheet: 'IQI', row: 2, revision: 'r1', pending: true },
        }),
      ),
    );
  });
  it('loads all pending records with an empty search', async () => {
    mocks.request.mockResolvedValue({ query: '', pendingOnly: true, groups: [] });
    renderWithAppProviders(<AssetsPage />);
    await userEvent.click(screen.getByLabelText('แสดงเฉพาะรายการรอค้นหา'));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        '/api/search?q=&pendingOnly=1',
        expect.objectContaining({}),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByText('รายการรอตรวจสอบทั้งหมด')).toBeTruthy();
  });
  it('saves dashboard drafts hidden by filters using their original revision', async () => {
    mocks.request.mockImplementation(async (path: string) =>
      path === '/api/dashboard'
        ? dashboard
        : { record: { ...dashRecord, revision: 'd2', inspection: 'ดี' }, unchanged: false },
    );
    renderWithAppProviders(<DashboardPage />);
    const user = userEvent.setup();
    await screen.findByText('IQI-001');
    await user.selectOptions(screen.getByLabelText('สถานะ IQI-001 SN1'), 'ดี');
    await user.type(screen.getByLabelText('ค้นหารายการ Dashboard'), 'no-match');
    expect(screen.queryByText('IQI-001')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด (1)' }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        '/api/dashboard/2/status',
        expect.objectContaining({}),
        { method: 'PUT', body: { status: 'ดี', revision: 'd1' } },
      ),
    );
    expect(await screen.findByText('บันทึกสำเร็จ 1 รายการ')).toBeTruthy();
  });
  it('validates password before calling login and displays backend errors', async () => {
    mocks.loginWithPassword.mockRejectedValue(new Error('รหัสผ่านไม่ถูกต้อง (HTTP 401)'));
    renderWithAppProviders(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'เข้าใช้งาน' }));
    expect(mocks.loginWithPassword).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'เข้าใช้งาน' }));
    expect(await screen.findByText('รหัสผ่านไม่ถูกต้อง (HTTP 401)')).toBeTruthy();
  });
  it('validates real ApiClient response schemas independently of component fixtures', async () => {
    const api = new ApiClient(
      undefined,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ authenticated: 'invalid', csrf: 123 })),
    );
    const { sessionSchema } = await import('../src/types/contracts');
    await expect(api.request('/api/auth/session', sessionSchema)).rejects.toThrow('รูปแบบ');
  });
});

describe('forms and photos', () => {
  it('preserves untouched CRLF, sends revision and keeps edits after a rejected save', async () => {
    const detail = {
      sheet: 'IQI',
      label: 'IQI',
      row: 2,
      headers: ['เลขครุภัณฑ์', 'หมายเหตุ'],
      values: ['IQI-001', 'old\r\nline'],
      assetIndex: 0,
      editable: true,
      revision: 'r1',
      dropdowns: [],
      dateIndex: 1,
      dateMode: 'inspection-note',
      today: '29/10/2569',
    };
    mocks.request.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/record')) return detail;
      throw new Error('ข้อมูลเปลี่ยนไป (HTTP 409)');
    });
    const onClose = vi.fn();
    renderWithAppProviders(
      <AssetRecordDialog target={{ sheet: 'IQI', row: 2 }} onClose={onClose} />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'แก้ไขข้อมูล' }));
    const asset = screen.getByLabelText('เลขครุภัณฑ์');
    await user.clear(asset);
    await user.type(asset, 'IQI-002');
    await user.click(screen.getByRole('button', { name: /^บันทึก$/ }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith('/api/iqi/2', expect.objectContaining({}), {
        method: 'PUT',
        body: { sheet: 'IQI', revision: 'r1', values: ['IQI-002', 'old\r\nline'] },
      }),
    );
    expect(await screen.findByText('ข้อมูลเปลี่ยนไป (HTTP 409)')).toBeTruthy();
    expect((screen.getByLabelText('เลขครุภัณฑ์') as HTMLTextAreaElement).value).toBe('IQI-002');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'ปิดรายละเอียด' }));
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('loads inspection before saving and submits only the existing target/status payload', async () => {
    mocks.request.mockImplementation(
      async (_path: string, _schema: unknown, options: { method?: string }) =>
        options.method === 'PUT'
          ? { status: 'ชำรุด', date: '29/10/2569' }
          : { status: 'ดี', date: '28/10/2569' },
    );
    const onSaved = vi.fn(),
      onClose = vi.fn();
    renderWithAppProviders(
      <ReviewInspectionDialog
        target={{ sheet: 'IQI', row: 2, revision: 'r1', asset: 'IQI-001' }}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    const user = userEvent.setup();
    await screen.findByText('แก้ไขล่าสุด: 28/10/2569');
    await user.selectOptions(screen.getByLabelText('สถานะการตรวจสอบ'), 'ชำรุด');
    await user.click(screen.getByRole('button', { name: 'บันทึกผลตรวจ' }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        '/api/review-inspection',
        expect.objectContaining({}),
        { method: 'PUT', body: { sheet: 'IQI', row: 2, revision: 'r1', status: 'ชำรุด' } },
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
  it('uploads sequential HEIC binaries with the revision returned by the prior upload', async () => {
    let count = 0;
    mocks.request.mockImplementation(async (path: string) =>
      path === '/api/upload-config'
        ? { maxUploadBytes: 4 * 1024 * 1024 }
        : {
            url: 'https://drive.google.com/file/d/test/view',
            bytes: 1,
            at: 'now',
            revision: `photo-${++count}`,
          },
    );
    const onRefresh = vi.fn().mockResolvedValue(undefined),
      onBusy = vi.fn();
    renderWithAppProviders(
      <AssetPhotoEditor
        record={dashboardRecordSchema.parse(dashRecord)}
        headers={dashboard.headers}
        busy={false}
        onBusy={onBusy}
        onRefresh={onRefresh}
      />,
    );
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('เลือกรูปครุภัณฑ์ IQI-001'), [
      new File(['a'], 'one.heic', { type: 'image/heic' }),
      new File(['b'], 'two.heic', { type: 'image/heic' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'อัปโหลด' }));
    expect(await screen.findByText('เพิ่มแล้ว 2/2 รูป')).toBeTruthy();
    const calls = mocks.request.mock.calls.filter(([path]) => path === '/api/dashboard/2/photos');
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[2]).toMatchObject({ method: 'POST', revision: 'd1' });
    expect(calls[1]?.[2]).toMatchObject({ method: 'POST', revision: 'photo-1' });
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
