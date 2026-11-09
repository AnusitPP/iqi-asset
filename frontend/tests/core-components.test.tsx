import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ViewToggle } from '../src/components/core/view-toggle';
import { EquipmentCard } from '../src/components/core/equipment-card';
import { CatalogPhoto } from '../src/components/core/catalog-photo';
import { SearchInput } from '../src/components/core/search-input';
afterEach(cleanup);

it('shared view toggle reports the selected view and emits the requested view', async () => {
  const change = vi.fn();
  render(
    <MantineProvider>
      <ViewToggle value="grid" onChange={change} />
    </MantineProvider>,
  );
  expect(screen.getByRole('button', { name: 'การ์ด' }).getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'รายการ' }));
  expect(change).toHaveBeenCalledWith('list');
});

it('shared equipment card preserves labels, badges and its action', async () => {
  const open = vi.fn();
  render(
    <MantineProvider>
      <EquipmentCard
        name="Monitor"
        category="จอ"
        detail="เลขคำขอ: L-1"
        badges={<span>กำลังยืม</span>}
        action={<button onClick={open}>ดูรายละเอียด</button>}
      />
    </MantineProvider>,
  );
  expect(screen.getByText('เลขคำขอ: L-1')).toBeTruthy();
  expect(screen.getByText('กำลังยืม')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'ดูรายละเอียด' }));
  expect(open).toHaveBeenCalledOnce();
});

it('shared photo rejects non-Drive links and search preserves accessible input props', () => {
  render(
    <MantineProvider>
      <CatalogPhoto url="https://example.com/file/d/private" name="Device" />
      <SearchInput label="ค้นหา" disabled maxLength={400} />
    </MantineProvider>,
  );
  expect(screen.getByLabelText('ไม่มีภาพอุปกรณ์')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect((screen.getByLabelText('ค้นหา') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByLabelText('ค้นหา').getAttribute('maxlength')).toBe('400');
});
import { RefreshButton, ResetFiltersButton } from '../src/components/core/action-buttons';
import { CopyableText } from '../src/components/core/copyable-text';
import { copyTextToClipboard } from '../src/lib/clipboard';
vi.mock('../src/lib/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

it('shared copy control uses the dashboard interaction and shows copy failures', async () => {
  render(
    <MantineProvider>
      <CopyableText value="STeP-IQI-L1" />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'คัดลอก STeP-IQI-L1' }));
  expect(copyTextToClipboard).toHaveBeenCalledWith('STeP-IQI-L1');
  expect(screen.getByRole('status').textContent).toBe('คัดลอกแล้ว');
  vi.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error('denied'));
  await userEvent.click(screen.getByRole('button', { name: 'คัดลอก STeP-IQI-L1' }));
  expect(screen.getByRole('status').textContent).toContain('คัดลอกไม่ได้');
});

it('shared refresh and reset buttons preserve disabled and callback behavior', async () => {
  const refresh = vi.fn(),
    reset = vi.fn();
  const view = render(
    <MantineProvider>
      <RefreshButton disabled onClick={refresh} />
      <ResetFiltersButton onClick={reset} />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'โหลดรายการล่าสุด' }));
  expect(refresh).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
  expect(reset).toHaveBeenCalledOnce();
  view.rerender(
    <MantineProvider>
      <RefreshButton onClick={refresh} />
    </MantineProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'โหลดรายการล่าสุด' }));
  expect(refresh).toHaveBeenCalledOnce();
});
import { RequestStatusBadge } from '../src/components/core/request-status-badge';

it('shared status badge uses central labels and normalizes completed requests', () => {
  const view = render(
    <MantineProvider>
      <RequestStatusBadge record={{ kind: 'ยืม', status: 'กำลังยืม', completed: true }} />
    </MantineProvider>,
  );
  expect(screen.getByText('เสร็จสิ้น')).toBeTruthy();
  expect(screen.queryByText('กำลังยืม')).toBeNull();
  view.rerender(
    <MantineProvider>
      <RequestStatusBadge record={{ kind: 'คืน', status: 'รอรับคืน', completed: true }} size="xs" />
    </MantineProvider>,
  );
  expect(screen.getByText('รอดำเนินการ')).toBeTruthy();
});
import { LoanPeriod } from '../src/components/core/loan-period';
import { LoanTimeBadge } from '../src/components/core/loan-time-badge';

it('loan period displays the overdue extension and retains the actual elapsed days', () => {
  const view = render(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-06" today="2026-11-07" />
    </MantineProvider>,
  );
  expect(screen.getByText('6 / 5 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
    '120% เกินกำหนด 1 วัน',
  );
  expect(screen.getByText('เกินกำหนด 1 วัน')).toBeTruthy();
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-06" today="2026-10-31" />
    </MantineProvider>,
  );
  expect(screen.getByText('0 / 5 วัน')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="" due="2026-11-06" today="2026-11-07" />
    </MantineProvider>,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('loan time pill retains an accessible time label', () => {
  render(
    <MantineProvider>
      <LoanTimeBadge text="เกินกำหนด 2 วัน" overdue />
    </MantineProvider>,
  );
  expect(screen.getByText('เกินกำหนด 2 วัน')).toBeTruthy();
});

it('loan period stays green with three days left and turns yellow with two days left', () => {
  const view = render(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-05" />
    </MantineProvider>,
  );
  expect(screen.getByText('เหลือ 3 วัน').style.color).toBe('var(--mantine-color-green-text)');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-06" />
    </MantineProvider>,
  );
  expect(screen.getByText('เหลือ 2 วัน').style.color).toBe('var(--mantine-color-yellow-text)');
  view.rerender(
    <MantineProvider>
      <LoanPeriod start="2026-11-01" due="2026-11-08" today="2026-11-09" />
    </MantineProvider>,
  );
  expect(screen.getByText('เกินกำหนด 1 วัน').style.color).toBe('var(--mantine-color-red-text)');
});
