import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { UsersList } from '../src/features/users/users-list';
import { userSchema } from '../src/types/account';
import { formatAccountActivity } from '../src/lib/account-display';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const now = Date.parse('2026-11-12T03:00:00Z');

it('formats elapsed activity minutes, hours, days and missing times', () => {
  expect(formatAccountActivity('2026-11-12T02:55:00Z', now)).toBe('เมื่อ 5 นาทีที่แล้ว');
  expect(formatAccountActivity('2026-11-12T02:59:45Z', now)).toBe('เมื่อสักครู่');
  expect(formatAccountActivity('2026-11-12T02:00:00Z', now)).toBe('เมื่อ 1 ชั่วโมงที่แล้ว');
  expect(formatAccountActivity('2026-11-11T03:00:00Z', now)).toBe('เมื่อ 1 วันที่แล้ว');
  expect(formatAccountActivity('invalid', now)).toBe('ยังไม่มีข้อมูล');
});

it.each([false, true])(
  'shows relative activity on mobile=%s without displaying account status in the list',
  (mobile) => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const records = [
      userSchema.parse({
        id: 'active',
        name: 'Active User',
        email: 'a@example.invalid',
        role: 'STAFF',
        status: 'ACTIVE',
        permissions: [],
        last_seen_at: '2026-11-12T02:55:00Z',
      }),
      userSchema.parse({
        id: 'disabled',
        name: 'Disabled User',
        email: 'd@example.invalid',
        role: 'STAFF',
        status: 'DISABLED',
        permissions: [],
      }),
    ];
    const view = render(
      <MantineProvider>
        <UsersList records={records} canManage={false} onSelect={vi.fn()} now={now} />
      </MantineProvider>,
    );
    expect(screen.getByText(/เมื่อ 5 นาทีที่แล้ว/)).toBeTruthy();
    expect(screen.queryByText('ใช้งานอยู่')).toBeNull();
    expect(screen.queryByText('DISABLED')).toBeNull();
    expect(screen.getByText(/ยังไม่มีข้อมูล/)).toBeTruthy();
    view.rerender(
      <MantineProvider>
        <UsersList records={records} canManage={false} onSelect={vi.fn()} now={now + 5 * 60000} />
      </MantineProvider>,
    );
    expect(screen.getByText(/เมื่อ 10 นาทีที่แล้ว/)).toBeTruthy();
  },
);
