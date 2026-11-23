import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PordDatabasePage } from '../src/features/porddatabase/porddatabase-page';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    user: { id: 'admin-test', role: 'ADMIN' },
    api: { request: mocks.request },
  }),
}));
const record = {
  sourceId: 'A1',
  cost: '26500',
  revision: 'r1',
  row: 2,
  asset: 'A1',
  serial: 'SN1',
  name: 'Monitor',
  status: 'ดี',
  location: '',
  photo: '',
  appStatus: 'ดี',
  pdfGroups: ['ชำรุด'],
  pdfStatus: 'ชำรุด',
  pdfCost: '26500',
  appMatched: true,
  appFields: {
    name: 'Monitor',
    serial: 'SN1',
    status: 'ดี',
    photo: 'https://example.com/photo.jpg',
  },
  sent: false,
  source: { 'เลขครุภัณฑ์ Apps Script': 'A1' },
};
let sent = false;
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <PordDatabasePage />
      </QueryClientProvider>
    </MantineProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sent = false;
  mocks.request.mockReset().mockImplementation(async (_path, _schema, options) =>
    options?.method === 'POST'
      ? ((sent = true), { sent: ['A1'], added: 1, skipped: 0, sheet: 'PORDDATABASE' })
      : {
          sheet: 'PORDDATABASE',
          records: [
            { ...record, sent },
            { ...record, sourceId: 'A2', asset: 'A2', row: 3 },
          ],
        },
  );
});
afterEach(cleanup);

it('uses the existing owner for an older browser draft and allows editing it before sending', async () => {
  localStorage.setItem(
    'iqi:porddatabase:v1:admin-test',
    JSON.stringify({ A1: { ...record, selected: false, reviewed: false } }),
  );
  mocks.request.mockImplementation(async (_path, _schema, options) =>
    options?.method === 'POST'
      ? { sent: ['A1'], added: 1, skipped: 0, sheet: 'PORDDATABASE' }
      : {
          sheet: 'PORDDATABASE',
          records: [
            {
              ...record,
              owner: 'ผู้ถือครองเดิม',
              appFields: { ...record.appFields, owner: 'ผู้ถือครองเดิม' },
            },
          ],
        },
  );
  mount();
  const edit = await screen.findByRole('button', { name: 'ตรวจ / แก้ไข' });
  await waitFor(() => expect(edit.hasAttribute('disabled')).toBe(false));
  expect(screen.getByText('ผู้ถือครองเดิม')).toBeTruthy();
  fireEvent.click(edit);
  const owner = await screen.findByRole('textbox', { name: 'ผู้ถือครอง' });
  expect((owner as HTMLInputElement).value).toBe('ผู้ถือครองเดิม');
  fireEvent.change(owner, { target: { value: 'ผู้ถือครองใหม่' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'ตรวจข้อมูลที่จะส่งแล้ว' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'เลือกรายการนี้เพื่อส่งชีตใหม่' }));
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกฉบับร่าง' }));
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'ผู้ถือครอง' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'ส่งที่เลือก (1)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'ยืนยันส่ง 1 รายการ' }));
  await waitFor(() =>
    expect(
      mocks.request.mock.calls.find((c) => c[2]?.method === 'POST')?.[2].body.records[0].owner,
    ).toBe('ผู้ถือครองใหม่'),
  );
});

it('shows matched Drive links and copies them into the editable draft', async () => {
  const photo =
    'https://drive.google.com/file/d/photo1/view\nhttps://drive.google.com/file/d/photo2/view';
  mocks.request.mockResolvedValue({
    sheet: 'PORDDATABASE',
    records: [
      {
        ...record,
        drivePhoto: photo,
        photo,
        appFields: { ...record.appFields, photo },
      },
    ],
  });
  mount();
  const edit = await screen.findByRole('button', { name: 'ตรวจ / แก้ไข' });
  await waitFor(() => expect(edit.hasAttribute('disabled')).toBe(false));
  fireEvent.click(edit);
  expect(
    await screen.findByText('รวมลิงก์รูปจาก Google Drive ที่ตรงกับเลขครุภัณฑ์แล้ว'),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ใช้ฝั่ง Appscriptdata' }));
  expect(
    (screen.getByRole('textbox', { name: 'ลิงก์รูปครุภัณฑ์' }) as HTMLTextAreaElement).value,
  ).toBe(photo);
  expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(false);
});

it('shortlists only unsent electronics without selecting them or hiding other records from the total', async () => {
  mocks.request.mockResolvedValue({
    sheet: 'PORDDATABASE',
    records: [
      record,
      {
        ...record,
        sourceId: 'DESK',
        asset: 'DESK',
        name: 'โต๊ะทำงาน',
        appFields: { name: 'โต๊ะทำงาน' },
      },
      { ...record, sourceId: 'SENT', asset: 'SENT', sent: true },
    ],
  });
  mount();
  const checkbox = await screen.findByRole('checkbox', { name: 'เลือก A1' });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole('checkbox', { name: 'เลือก DESK' })).toBeNull();
  expect(screen.queryByRole('checkbox', { name: 'เลือก SENT' })).toBeNull();
  expect(screen.getByText('อิเล็กทรอนิกส์ยังไม่ส่ง 1 รายการ')).toBeTruthy();
  expect(screen.getByText('ต้องจัดการ 2 รายการ')).toBeTruthy();
  expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(false);
});

it('starts unselected and restores manual selections across a page reload', async () => {
  const view = mount();
  const check = await screen.findByRole('checkbox', { name: 'เลือก A1' });
  await waitFor(() => expect(check.hasAttribute('disabled')).toBe(false));
  expect((check as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: 'เลือก A2' }) as HTMLInputElement).checked).toBe(
    false,
  );
  fireEvent.click(check);
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem('iqi:porddatabase:v1:admin-test') || '{}').A1.selected,
    ).toBe(true),
  );
  view.unmount();
  mount();
  await waitFor(() =>
    expect((screen.getByRole('checkbox', { name: 'เลือก A1' }) as HTMLInputElement).checked).toBe(
      true,
    ),
  );
  expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(false);
});

it('saves edited drafts without category and sends only the manually selected row', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole('checkbox', { name: 'เลือก A1' });
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: 'ตรวจ / แก้ไข' })[0]!.hasAttribute('disabled'),
    ).toBe(false),
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'ตรวจ / แก้ไข' })[0]!);
  const name = await screen.findByRole('textbox', { name: /ชื่ออุปกรณ์/ });
  const cost = screen.getByRole('textbox', { name: 'ราคาทุนจาก PDF (บาท)' });
  expect((cost as HTMLInputElement).value).toBe('26500');
  expect((cost as HTMLInputElement).readOnly).toBe(true);
  await user.click(await screen.findByRole('button', { name: 'ใช้ฝั่ง Appscriptdata' }));
  fireEvent.change(name, { target: { value: 'Edited monitor' } });
  await user.click(screen.getByRole('checkbox', { name: 'เลือกรายการนี้เพื่อส่งชีตใหม่' }));
  await user.click(screen.getByRole('button', { name: 'บันทึกฉบับร่าง' }));
  await user.click(screen.getByRole('button', { name: 'ส่งที่เลือก (1)' }));
  await user.click(screen.getByRole('button', { name: 'ยืนยันส่ง 1 รายการ' }));
  await waitFor(() =>
    expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(true),
  );
  const request = mocks.request.mock.calls.find((c) => c[2]?.method === 'POST')![2];
  expect(request.body.records).toHaveLength(1);
  expect(request.body.records[0]).toMatchObject({
    sourceId: 'A1',
    name: 'Edited monitor',
    selected: true,
  });
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'เลือก A1' })).toBeNull());
});

it('lets the user choose PDF status and then an Appscriptdata field independently', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole('checkbox', { name: 'เลือก A1' });
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: 'ตรวจ / แก้ไข' })[0]!.hasAttribute('disabled'),
    ).toBe(false),
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'ตรวจ / แก้ไข' })[0]!);
  await user.click(await screen.findByRole('button', { name: 'ใช้ฝั่ง Appscriptdata' }));
  await user.click(screen.getByRole('button', { name: 'ใช้ฝั่ง PDF' }));
  expect((screen.getByRole('textbox', { name: 'สภาพ' }) as HTMLInputElement).value).toBe('ชำรุด');
  expect(
    (screen.getByRole('textbox', { name: 'ลิงก์รูปครุภัณฑ์' }) as HTMLInputElement).value,
  ).toBe('https://example.com/photo.jpg');
  expect(
    (screen.getByRole('checkbox', { name: 'ตรวจข้อมูลที่จะส่งแล้ว' }) as HTMLInputElement).checked,
  ).toBe(true);
  expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(false);
});

it('hides previously sent PDF records by default and leaves unsent records visible', async () => {
  sent = true;
  mount();
  await screen.findByRole('checkbox', { name: 'เลือก A2' });
  expect(screen.queryByRole('checkbox', { name: 'เลือก A1' })).toBeNull();
  expect(screen.getByText('ต้องจัดการ 1 รายการ')).toBeTruthy();
});

it('shows unsent Appscriptdata records outside the PDF by default without selecting or sending them', async () => {
  mocks.request.mockResolvedValue({
    sheet: 'PORDDATABASE',
    records: [
      { ...record, sent: true },
      { ...record, sourceId: 'APP-ONLY', asset: 'APP-ONLY', pdfGroups: [], pdfStatus: '' },
    ],
  });
  mount();
  const checkbox = await screen.findByRole('checkbox', { name: 'เลือก APP-ONLY' });
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole('checkbox', { name: 'เลือก A1' })).toBeNull();
  expect(screen.getByText('ต้องจัดการ 1 รายการ')).toBeTruthy();
  expect(screen.getByText('Appscriptdata ยังไม่ส่ง 1 รายการ')).toBeTruthy();
  expect(screen.getByText('PDF ยังไม่ส่ง 0 รายการ')).toBeTruthy();
  expect(mocks.request.mock.calls.some((c) => c[2]?.method === 'POST')).toBe(false);
});
