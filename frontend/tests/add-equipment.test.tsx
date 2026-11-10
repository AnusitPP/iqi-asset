import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddEquipment } from '../src/features/lending/add-equipment';
const state = vi.hoisted(() => ({ role: 'STAFF', request: vi.fn() }));
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
it('retries only the photo after equipment was saved', async () => {
  state.role = 'ADMIN';
  state.request
    .mockResolvedValueOnce({ preview: 'data:image/jpeg;base64,cGhvdG8=' })
    .mockResolvedValueOnce({ row: 19, asset: 'A', serial: '', name: 'Mouse' })
    .mockRejectedValueOnce(new Error('Drive offline'))
    .mockResolvedValueOnce({ url: 'https://drive.google.com/file/d/photo/view' });
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เพิ่มครุภัณฑ์' }));
  await user.type(screen.getByLabelText(/เลขครุภัณฑ์/), 'A');
  await user.type(screen.getByLabelText(/ชื่ออุปกรณ์/), 'Mouse');
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await user.upload(input, new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }));
  await user.click(screen.getByRole('button', { name: 'บันทึกครุภัณฑ์' }));
  await screen.findByText(/เพิ่มครุภัณฑ์แล้ว แต่ยังเพิ่มรูปไม่สำเร็จ/);
  await user.click(screen.getByRole('button', { name: 'บันทึกรูป' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(state.request.mock.calls.filter(([path]) => path === '/api/loan-catalog')).toHaveLength(1);
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

it('uploads three photos and retries the remaining photos without repeating successful ones', async () => {
  state.role = 'ADMIN';
  let uploads = 0;
  state.request.mockImplementation(async (path) => {
    if (path.endsWith('/preview')) return { preview: 'data:image/jpeg;base64,cGhvdG8=' };
    if (path === '/api/loan-catalog') return { row: 19, asset: 'A', serial: '', name: 'Mouse' };
    uploads++;
    if (uploads === 2) throw new Error('offline');
    return { url: 'https://drive.google.com/file/d/photo/view' };
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
  await screen.findByText(/เพิ่มครุภัณฑ์แล้ว แต่ยังเพิ่มรูปไม่สำเร็จ/);
  await user.click(screen.getByRole('button', { name: 'บันทึกรูป' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(uploads).toBe(4);
  const uploadedNames = state.request.mock.calls
    .filter(([path]) => path.endsWith('/photos'))
    .map(([, , options]) => options.binary.name);
  expect(uploadedNames).toEqual(['1.jpg', '2.jpg', '2.jpg', '3.jpg']);
});
