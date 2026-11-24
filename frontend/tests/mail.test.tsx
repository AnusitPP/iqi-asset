import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MailPage } from '../src/features/mail/mail-page';
import { UnsavedChangesProvider } from '../src/hooks/use-unsaved';

const request = vi.hoisted(() => vi.fn());
vi.mock('../src/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ api: { request }, can: () => true }),
}));
afterEach(() => {
  cleanup();
  request.mockReset();
});

it('previews selected mock groups inline, supports empty state and keeps live sending separate', async () => {
  request.mockResolvedValue({
    subject: '[ข้อมูลจำลอง] IQI Asset',
    html: '<!-- IQI_MAIL_LOGO_START --><!-- IQI_MAIL_LOGO_END --><p>ตัวอย่าง</p>',
  });
  const user = userEvent.setup();
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>
        <UnsavedChangesProvider>
          <MailPage />
        </UnsavedChangesProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  await user.click(screen.getByRole('checkbox', { name: 'รออนุมัติ' }));
  await user.click(screen.getByRole('button', { name: 'ดูตัวอย่างข้อมูลจำลอง' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/mail/mockup', expect.anything(), {
      method: 'POST',
      body: { groups: ['return', 'overdue'] },
    }),
  );
  const frame = await screen.findByTitle('ตัวอย่างเนื้อหาอีเมลที่จะส่ง');
  expect(frame.getAttribute('srcdoc')).toContain('src="/icon.png"');
  expect(frame.getAttribute('srcdoc')).toContain('<p>ตัวอย่าง</p>');
  expect(frame.getAttribute('sandbox')).toBe('');
  await user.click(screen.getByRole('checkbox', { name: 'รอรับคืน' }));
  expect(screen.queryByTitle('ตัวอย่างเนื้อหาอีเมลที่จะส่ง')).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'ยืมเกินกำหนด' }));
  await user.click(screen.getByRole('button', { name: 'ดูตัวอย่างข้อมูลจำลอง' }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/mail/mockup', expect.anything(), {
      method: 'POST',
      body: { groups: [] },
    }),
  );
  request.mockResolvedValue({
    subject: 'IQI Asset',
    html: '<!-- IQI_MAIL_LOGO_START --><img src="https://old.example.invalid/icon.png"><!-- IQI_MAIL_LOGO_END -->',
  });
  await user.click(screen.getByRole('button', { name: 'ดูตัวอย่างอีเมลจริง' }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/mail/preview', expect.anything(), {
      method: 'POST',
      body: { type: 'summary' },
    }),
  );
  await waitFor(() => {
    const html = screen.getByTitle('ตัวอย่างเนื้อหาอีเมลที่จะส่ง').getAttribute('srcdoc');
    expect(html).toContain('src="/icon.png"');
    expect(html).not.toContain('old.example.invalid');
  });
  expect(request.mock.calls.some(([path]) => path === '/api/mail/send')).toBe(false);
});
