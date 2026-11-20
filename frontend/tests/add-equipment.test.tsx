import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddEquipment } from '../src/features/lending/add-equipment';
const state = vi.hoisted(() => ({ role: 'STAFF', request: vi.fn(), prepare: vi.fn() }));
vi.mock('../src/services/photos.service', () => ({
  photosService: {
    fetchUploadLimits: vi.fn().mockResolvedValue({ maxUploadBytes: 4 * 1024 * 1024 }),
  },
}));
vi.mock('../src/features/photos/photo-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/features/photos/photo-utils')>()),
  preparePhotoForUpload: state.prepare.mockImplementation(
    async (file: File) => new File(['compressed'], file.name, { type: 'image/jpeg' }),
  ),
}));
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ user: { role: state.role }, api: { request: state.request } }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mount() {
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>
        <AddEquipment disabled={false} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}
it('drops multiple photos, adds another selection, and uploads the chosen first photo first', async () => {
  state.role = 'ADMIN';
  state.request.mockImplementation(async (path, _schema, options) => {
    if (path.endsWith('/preview'))
      return { preview: `data:image/jpeg;base64,${btoa(options.binary.name)}` };
    if (path === '/api/loan-catalog') return { row: 19, asset: 'A', serial: '', name: 'Mouse' };
    return { url: 'https://drive.google.com/file/d/photo/view' };
  });
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
  await user.type(screen.getByLabelText(/เลขครุภัณฑ์/), 'A');
  await user.type(screen.getByLabelText(/ชื่ออุปกรณ์/), 'Mouse');
  const files = [1, 2, 3].map((n) => new File(['photo'], `${n}.jpg`, { type: 'image/jpeg' }));
  fireEvent.drop(screen.getByRole('group', { name: 'พื้นที่วางรูปภาพ' }), {
    dataTransfer: { files: files.slice(0, 2) },
  });
  await screen.findByText('2.jpg');
  await user.upload(document.querySelector('input[type=file]') as HTMLInputElement, files[2]!);
  await screen.findByText('3.jpg');
  await user.click(screen.getByRole('button', { name: 'ตั้งรูปที่ 2 เป็นรูปแรก' }));
  expect(
    screen.getByRole('button', { name: 'ตั้งรูปที่ 1 เป็นรูปแรก' }).getAttribute('aria-pressed'),
  ).toBe('true');
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(
    state.request.mock.calls.find(([path]) => path === '/api/loan-catalog')?.[2].body.photos,
  ).toEqual(['2.jpg', '1.jpg', '3.jpg'].map((name) => `data:image/jpeg;base64,${btoa(name)}`));
  expect(state.request.mock.calls.some(([path]) => path.endsWith('/photos'))).toBe(false);
});
it('hides add equipment from staff', () => {
  state.role = 'STAFF';
  mount();
  expect(screen.queryByRole('button', { name: 'เพิ่มครุภัณฑ์' })).toBeNull();
});
it.each(['ADMIN', 'SUPER_ADMIN'])(
  'allows %s to save equipment with sheet fields and closes on success',
  async (role) => {
    state.role = role;
    state.request.mockResolvedValue({ row: 19, asset: 'A-1', serial: 'SN1', name: 'Mouse' });
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
    await user.type(screen.getByLabelText(/เลขครุภัณฑ์/), 'A-1');
    await user.type(screen.getByLabelText('S/N'), 'SN1');
    await user.type(screen.getByLabelText(/ชื่ออุปกรณ์/), 'Mouse');
    await user.click(screen.getByRole('combobox', { name: /หมวดหมู่/ }));
    await user.click(screen.getByRole('option', { name: 'USB WI-FI' }));
    await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
    await waitFor(() =>
      expect(state.request).toHaveBeenCalledWith('/api/loan-catalog', expect.anything(), {
        method: 'POST',
        body: { asset: 'A-1', serial: 'SN1', name: 'Mouse', category: 'USB WI-FI' },
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  },
);
it('retains the complete draft after failed save and retries equipment with all photos', async () => {
  state.role = 'ADMIN';
  state.request
    .mockResolvedValueOnce({ preview: 'data:image/jpeg;base64,cGhvdG8=' })
    .mockRejectedValueOnce(new Error('อัปโหลดเข้า Drive ไม่สำเร็จ'))
    .mockResolvedValueOnce({ row: 19, asset: 'A', serial: '', name: 'Mouse' });
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
  await user.type(screen.getByLabelText(/เลขครุภัณฑ์/), 'A');
  await user.type(screen.getByLabelText(/ชื่ออุปกรณ์/), 'Mouse');
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await user.upload(input, new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }));
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await screen.findByText('อัปโหลดเข้า Drive ไม่สำเร็จ');
  expect(screen.getByLabelText(/เลขครุภัณฑ์/)).toHaveProperty('value', 'A');
  expect(screen.getByLabelText(/เลขครุภัณฑ์/)).toHaveProperty('disabled', false);
  expect(screen.queryByText(/เพิ่มครุภัณฑ์แล้ว/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'รีเฟรช' }));
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const saves = state.request.mock.calls.filter(([path]) => path === '/api/loan-catalog');
  expect(saves).toHaveLength(2);
  expect(saves[0]![2].body).toEqual(saves[1]![2].body);
});

it('previews three photos before saving, supports replacement/removal and rejects a fourth', async () => {
  state.role = 'ADMIN';
  state.request.mockResolvedValue({ preview: 'data:image/jpeg;base64,cGhvdG8=' });
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  const files = ['one', 'two', 'three', 'four'].map(
    (name) => new File(['photo'], `${name}.jpg`, { type: 'image/jpeg' }),
  );
  await user.upload(input, files);
  await screen.findByText('เลือกได้อีก 3 รูปเท่านั้น');
  expect(state.request).not.toHaveBeenCalled();
  await user.upload(input, files.slice(0, 3));
  await waitFor(() =>
    expect(screen.getAllByRole('img', { name: /ภาพตัวอย่างรูปที่/ })).toHaveLength(3),
  );
  expect(state.request.mock.calls.every(([path]) => path === '/api/loan-catalog/preview')).toBe(
    true,
  );
  const preview = screen.getByRole('img', { name: 'ภาพตัวอย่างรูปที่ 1' });
  expect(preview.getAttribute('src')).toBe('data:image/jpeg;base64,cGhvdG8=');
  const replaceInput = screen
    .getByRole('button', { name: 'เปลี่ยนรูปที่ 1' })
    .parentElement?.querySelector('input[type=file]') as HTMLInputElement;
  await user.upload(replaceInput, new File(['photo'], 'four.jpg', { type: 'image/jpeg' }));
  await screen.findByText('four.jpg');
  await user.click(screen.getByRole('button', { name: 'ลบรูปที่ 2' }));
  expect(screen.getAllByRole('img', { name: /ภาพตัวอย่างรูปที่/ })).toHaveLength(2);
});

it('submits all three prepared photos in one save without publishing a partial record', async () => {
  state.role = 'ADMIN';
  let uploads = 0;
  state.request.mockImplementation(async (path) => {
    if (path.endsWith('/preview')) return { preview: 'data:image/jpeg;base64,cGhvdG8=' };
    uploads++;
    if (uploads === 1) throw new Error('อัปโหลดรูปไม่สำเร็จ');
    return { row: 19, asset: 'A', serial: '', name: 'Mouse' };
  });
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
  await user.type(screen.getByLabelText(/เลขครุภัณฑ์/), 'A');
  await user.type(screen.getByLabelText(/ชื่ออุปกรณ์/), 'Mouse');
  await user.upload(
    document.querySelector('input[type=file]') as HTMLInputElement,
    [1, 2, 3].map((n) => new File(['photo'], `${n}.jpg`, { type: 'image/jpeg' })),
  );
  await waitFor(() =>
    expect(screen.getAllByRole('img', { name: /ภาพตัวอย่างรูปที่/ })).toHaveLength(3),
  );
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await screen.findByText('อัปโหลดรูปไม่สำเร็จ');
  await user.click(screen.getByRole('button', { name: 'รีเฟรช' }));
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(uploads).toBe(2);
  const saves = state.request.mock.calls.filter(([path]) => path === '/api/loan-catalog');
  expect(saves[0]![2].body.photos).toHaveLength(3);
  expect(saves[0]![2].body).toEqual(saves[1]![2].body);
  expect(state.request.mock.calls.some(([path]) => path.endsWith('/photos'))).toBe(false);
  expect(state.prepare).toHaveBeenCalledTimes(3);
  expect(state.prepare).toHaveBeenCalledWith(expect.any(File), 900 * 1024);
});
